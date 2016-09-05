import _ from 'lodash'
import SocketClient from 'socket.io-client'
import QueueState from '../graphql/types/RunnerQueueStateEnum'
import RunnerState from '../graphql/types/RunnerNodeStateEnum'
let { UNSCHEDULED } = QueueState.values
let { ONLINE } = RunnerState.values

export function getNextRunner (self, nodeList, success, fail, idx = 0) {
  let disconnected = false
  if (idx >= nodeList.length) {
    if (self._state === ONLINE) return success({ id: self._id })
    else return fail('No runners meet the run requirements')
  }
  let node = nodeList[idx]
  idx++
  if (node.id === self._id && self._state === ONLINE) return success({ id: self._id })
  if (!node.host || !node.port) return getNextRunner(self, nodeList, success, fail, idx)

  let socket = SocketClient(`http://${node.host}:${node.port}`, { timeout: 2000 })
  socket.on('connected', () => socket.emit('status'))
  socket.on('status', (data) => {
    disconnected = true
    socket.emit('disconnect')
    socket.disconnect(0)
    if (data.state === ONLINE) return resolve(data)
    else return getNextRunner(self, nodeList, success, fail, idx)
  })
  socket.on('connect_error', () => {
    if (!disconnected) {
      disconnected = true
      socket.emit('disconnect')
      socket.disconnect(0)
      return getNextRunner(self, nodeList, success, fail, idx)
    }
  })
  socket.on('connect_timeout', () => {
    if (!disconnected) {
      disconnected = true
      socket.emit('disconnect')
      socket.disconnect(0)
      return getNextRunner(self, nodeList, success, fail, idx)
    }
  })
}

export function getOnlineRunner (self, nodeList) {
  return new Promise((resolve, reject) => getNextRunner(self, nodeList, resolve, reject))
}

export default function schedule (socket, action, context) {
  if (!_.has(this._actions, action)) {
    socket.emit('schedule.error', `${action} is not a known action`)
    this.logError('Invalid action requested', { method: 'schedule', action })
    return new Promise((resolve, reject) => reject('Invalid action requested'))
  }

  return this._lib.Runner(`mutation Mutation {
      createQueue (
        action: "${action}",
        context: "${JSON.stringify(context)}",
        state: ${UNSCHEDULED}
      ) { id, action, context }  
    }`)
    .then((result) => {
      let queue = _.get(result, 'data.createQueue')
      if (result.errors || !queue) {
        this.logDebug('Failed to schedule', { method: 'schedule', errors: result.errors, action })
        return socket.emit('schedule.error', `failed to schedule ${action}`)
      } else {
        // get nodes that appear to be online
        return this._lib.Runner(`{
          readRunner (state: ${ONLINE}) { id, host, port, zone { id, name, description, metadata }, state, metadata } }
        }`)
          .then((result) => {
            let nodes = _.get(result, 'data.readRunner')
            if (result.errors || !nodes) {
              this.logDebug('Failed to schedule', { method: 'schedule', errors: result.errors, action })
              return socket.emit('schedule.error', `failed to schedule ${action}`)
            }
            return this._scheduler(this._id, nodes, queue)
              .then((nodeList) => {
                return getOnlineRunner(!_.isArray(nodeList) || !nodeList.length ? [this._id] : nodeList)
                  .then((node) => {
                    console.log('node scheduled is', node)
                  })
              })
              .catch((err) => {
                this.logDebug('Failed to schedule', { method: 'schedule', errors: err, action })
                return socket.emit('schedule.error', `failed to schedule ${action} because ${err}`)
              })
          })
      }
    })
    .catch((err) => {
      this.logDebug('Failed to schedule', { method: 'schedule', errors: err, action })
      return socket.emit('schedule.error', `failed to schedule ${action}`)
    })
}