import chalk from 'chalk'
import _ from 'lodash'
import SocketClient from 'socket.io-client'
import QueueState from '../graphql/types/RunnerQueueStateEnum'
import RunnerState from '../graphql/types/RunnerNodeStateEnum'
import { toLiteralJSON } from './common'
let { SCHEDULED, UNSCHEDULED } = QueueState.values
let { ONLINE } = RunnerState.values

/*
 * Loops through each node in the node list and determines if it is reachable
 */
export function getNextRunner (nodeList, success, fail, idx = 0) {
  let disconnected = false
  if (idx >= nodeList.length) {
    if (this._state === ONLINE) return success(this.info())
    else return fail('No runners meet the run requirements')
  }
  let node = nodeList[idx]
  idx++
  if (node.id === this._id && this._state === ONLINE) return success(node)
  if (!node.host || !node.port) return getNextRunner.call(this, nodeList, success, fail, idx)

  let socket = SocketClient(`http://${node.host}:${node.port}`, { timeout: 2000 })
  socket.on('connected', () => socket.emit('status'))
  socket.on('status', (data) => {
    disconnected = true
    socket.emit('disconnect')
    socket.disconnect(0)
    if (data.state === ONLINE) return resolve(data)
    else return getNextRunner.call(this, nodeList, success, fail, idx)
  })
  socket.on('connect_error', () => {
    if (!disconnected) {
      disconnected = true
      socket.emit('disconnect')
      socket.disconnect(0)
      return getNextRunner.call(this, nodeList, success, fail, idx)
    }
  })
  socket.on('connect_timeout', () => {
    if (!disconnected) {
      disconnected = true
      socket.emit('disconnect')
      socket.disconnect(0)
      return getNextRunner.call(this, nodeList, success, fail, idx)
    }
  })
}

/*
 * Entry point for checking online runners
 */
export function checkRunners (nodeList) {
  return new Promise((resolve, reject) => getNextRunner.call(this, nodeList, resolve, reject))
}

/*
 * Assigns task to a runner
 */
export function setSchedule (socket, action, context, nodes, queue) {
  return new Promise((resolve, reject) => {
    return this._scheduler(this, nodes, queue, (err, nodeList) => {
      if (err) {
        this.logDebug('Failed to schedule', { method: 'schedule', errors: err.message, stack: err.stack, action, marker: 3 })
        socket.emit('schedule.error', `failed to schedule ${action} because ${err}`)
        return reject(err)
      }
      if (!_.isArray(nodeList)) nodeList = [this.info()]
      return resolve(checkRunners.call(this, nodeList)
        .then((node) => {
          return this._lib.Runner(`
            mutation Mutation {
              updateQueue (
                id: "${queue.id}",
                runner: "${node.id}",
                state: ${SCHEDULED}
              ) { id }
            }
          `)
            .then((result) => {
              console.log(chalk.blue(JSON.stringify(result, null, '  ')))
              let queue = _.get(result, 'data.updateQueue')
              if (result.errors) throw new Error('Failed to update queue')
              this.logInfo('Successfully scheduled queue', {
                runner: node.id,
                queue: queue.id
              })
            })
            .catch((err) => {
              this.logDebug('Failed to schedule', { method: 'schedule', errors: err.message, stack: err.stack, action, marker: 4 })
            })
        }))
    })
  })
}

/*
 * Queries runner document for online runners and then calls
 * function to check node directly via socket status message
 */
export function getOnlineRunner (socket, action, context, queue) {
  // get nodes that appear to be online
  return this._lib.Runner(`{
            readRunner (state: ${ONLINE}) { id, host, port, zone { id, name, description, metadata }, state, metadata }
          }`)
    .then((result) => {
      let nodes = _.get(result, 'data.readRunner')
      if (result.errors || !nodes) {
        this.logDebug('Failed to schedule', { method: 'schedule', errors: result.errors, action, marker: 2 })
        return socket.emit('schedule.error', `failed to schedule ${action}`)
      }
      return setSchedule.call(this, socket, action, context, nodes, queue)
    })
}

/*
 * Creates a queue document immediately after receiving it then tries to schedule it
 */
export function createQueue (socket, action, context) {
  return this._lib.Runner(`mutation Mutation {
      createQueue (
        action: "${action}",
        context: ${toLiteralJSON(context)},
        state: ${UNSCHEDULED}
      ) { id, action, context }  
    }`)
    .then((result) => {
      let queue = _.get(result, 'data.createQueue')
      if (result.errors || !queue) {
        this.logDebug('Failed to schedule', { method: 'schedule', errors: result.errors, action, marker: 1 })
        return socket.emit('schedule.error', `failed to schedule ${action}`)
      } else {
        socket.emit('schedule.accept', {})
        return getOnlineRunner.call(this, socket, action, context, queue)
      }
    })
    .catch((err) => {
      this.logDebug('Failed to schedule', { method: 'schedule', errors: err, action, marker: 4 })
      return socket.emit('schedule.error', `failed to schedule ${action}`)
    })
}

// entry point for schedule request
export function schedule (socket, payload) {
  let { action, context } = payload
  if (!_.has(this._actions, action)) {
    socket.emit('schedule.error', `${action} is not a known action`)
    this.logError('Invalid action requested', { method: 'schedule', action })
    return new Promise((resolve, reject) => reject('Invalid action requested'))
  }
  return createQueue.call(this, socket, action, context)
}

// export the entry method
export default schedule