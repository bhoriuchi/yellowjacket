import _ from 'lodash'
import SocketClient from 'socket.io-client'
import QueueState from '../graphql/types/RunnerQueueStateEnum'
import RunnerState from '../graphql/types/RunnerNodeStateEnum'
import { toLiteralJSON } from './common'
import { EVENTS } from './const'
let source = 'server/schedule.js'
let { SCHEDULED, UNSCHEDULED } = QueueState.values
let { ONLINE } = RunnerState.values
let {
  CONNECTED,
  CONNECT_ERROR,
  CONNECT_TIMEOUT,
  DISCONNECT,
  STATUS,
  SCHEDULE_ERROR,
  SCHEDULE_ACCEPT,
  RUN,
  OK
} = EVENTS

// cleans up socket connection
export function disconnectSocket (socket) {
  socket.emit(DISCONNECT)
  socket.disconnect(0)
  return true
}

/*
 * Sends a message and then disconnects after response or error
 */
export function emitOnce (host, port, evt, listeners, onError = () => false, timeout = 2000) {
  let disconnected = false
  let socket = SocketClient(`http://${host}:${port}`, { timeout })

  socket.on(CONNECTED, () => socket.emit(evt))

  _.forEach(listeners, (fn, e) => {
    socket.on(e, (data) => {
      disconnected = disconnectSocket(socket)
      return fn(data)
    })
  })

  socket.on(CONNECT_ERROR, () => {
    if (!disconnected) {
      disconnected = disconnectSocket(socket)
      return onError()
    }
  })
  socket.on(CONNECT_TIMEOUT, () => {
    if (!disconnected) {
      disconnected = disconnectSocket(socket)
      return onError()
    }
  })
}


/*
 * Loops through each node in the node list and determines if it is reachable
 */
export function getNextRunner (nodeList, success, fail, idx = 0) {
  if (idx >= nodeList.length) {
    if (this._state === ONLINE) return success(this.info())
    else return fail(new Error('No runners meet the run requirements'))
  }
  let node = nodeList[idx]
  idx++
  if (node.id === this._id && this._state === ONLINE) return success(node)
  if (!node.host || !node.port) return getNextRunner.call(this, nodeList, success, fail, idx)

  return emitOnce(
    node.host,
    node.port,
    STATUS,
    {
      [STATUS]: (data) => {
        if (data.state === ONLINE) return resolve(data)
        else return getNextRunner.call(this, nodeList, success, fail, idx)
      }
    },
    () => getNextRunner.call(this, nodeList, success, fail, idx)
  )
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
        this.logDebug('Failed to schedule', {
          method: 'schedule',
          errors: err.message || err,
          stack: err.stack,
          action,
          marker: 3,
          source
        })
        socket.emit(SCHEDULE_ERROR, `failed to schedule ${action} because ${err}`)
        return reject(err)
      }

      // fallback to self if no nodes
      if (!_.isArray(nodeList)) {
        if (this._state !== ONLINE) return reject(new Error('No acceptable nodes were found'))
        nodeList = [this.info()]
      }

      // attempt to ping the runners
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
              let queue = _.get(result, 'data.updateQueue', {})
              if (result.errors || !queue.id) throw new Error('Failed to update queue')
              this.logInfo('Successfully scheduled queue', { runner: node.id, queue: queue.id })
              return emitOnce(node.host, node.port, RUN, { [OK]: () => disconnectSocket(socket) })
            })
            .catch((err) => {
              this.logDebug('Failed to schedule', {
                method: 'schedule',
                errors: err.message || err,
                stack: err.stack,
                action,
                marker: 4,
                source
              })
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
        this.logDebug('Failed to schedule', {
          method: 'schedule',
          errors: result.errors,
          action,
          marker: 2,
          source
        })
        return socket.emit(SCHEDULE_ERROR, `failed to schedule ${action}`)
      }
      return setSchedule.call(this, socket, action, context, nodes, queue)
    })
    .catch((err) => {
      this.logDebug('Failed to schedule', {
        method: 'schedule',
        errors: err.message || err,
        stack: err.stack,
        action,
        marker: 5,
        source
      })
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
        this.logDebug('Failed to schedule', {
          method: 'schedule',
          errors: result.errors,
          action,
          marker: 1,
          source
        })
        return socket.emit('schedule.error', `failed to schedule ${action}`)
      } else {
        socket.emit(SCHEDULE_ACCEPT)
        return getOnlineRunner.call(this, socket, action, context, queue)
      }
    })
    .catch((err) => {
      this.logDebug('Failed to schedule', {
        method: 'schedule',
        errors: err.message || err,
        stack: err.stack,
        action,
        marker: 4,
        source
      })
      return socket.emit(SCHEDULE_ERROR, `failed to schedule ${action}`)
    })
}

// entry point for schedule request
export function schedule (socket, payload) {
  let { action, context } = payload
  if (!_.has(this._actions, action)) {
    socket.emit(SCHEDULE_ERROR, `${action} is not a known action`)
    this.logError('Invalid action requested', { method: 'schedule', action, source })
    return new Promise((resolve, reject) => reject('Invalid action requested'))
  }
  return createQueue.call(this, socket, action, context)
}

// export the entry method
export default schedule