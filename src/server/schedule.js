import _ from 'lodash'
import SocketClient from 'socket.io-client'
import QueueState from '../graphql/types/RunnerQueueStateEnum'
import RunnerState from '../graphql/types/RunnerNodeStateEnum'
import { toLiteralJSON } from './common'
let { UNSCHEDULED } = QueueState.values
let { ONLINE } = RunnerState.values

/*
 * Loops through each node in the node list and determines if it is reachable
 */
export function getNextRunner (nodeList, success, fail, idx = 0) {
  let disconnected = false
  if (idx >= nodeList.length) {
    if (this._state === ONLINE) return success({ id: this._id })
    else return fail('No runners meet the run requirements')
  }
  let node = nodeList[idx]
  idx++
  if (node.id === this._id && this._state === ONLINE) return success({ id: this._id })
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
  return this._scheduler(this._id, nodes, queue)
    .then((nodeList) => {
      if (!_.isArray(nodeList)) {
        nodeList = [this.info()]
      }
      return checkRunners.call(this, nodeList)
        .then((node) => {
          console.log('node scheduled is', node)
        })
        .catch((err) => {
          console.log('THE ERROR IS', err)
          throw err
        })
    })
    .catch((err) => {
      this.logDebug('Failed to schedule', { method: 'schedule', errors: err.message, stack: err.stack, action, marker: 3 })
      return socket.emit('schedule.error', `failed to schedule ${action} because ${err}`)
    })
}

/*
 * Queries runner document for online runners and then calls
 * function to check node directly via socket status message
 */
export function getOnlineRunner (socket, action, context) {
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
        return getOnlineRunner.call(this, socket, action, context)
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