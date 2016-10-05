import _ from 'lodash'
import RunnerNodeStateEnum from '../graphql/types/RunnerNodeStateEnum'
import { EVENTS } from '../common/const'
let { STOPPING, STOPPING_ACK } = EVENTS
let { values: { OFFLINE } } = RunnerNodeStateEnum

export function forceStop (socket, requestId) {
  this.log.info({ server: this._server }, 'stopping server')

  // if no socket, immediately exit
  if (!socket) process.exit()

  // send an ok response to cleanly exit
  // but also set a timeout for 5 seconds to ensure the process exits
  socket.on(STOPPING_ACK, () => {
    this.log.debug({ server: this._server }, 'got server stop acknowledgement from client, exiting process')
    process.exit()
  })
  socket.emit(`${STOPPING}.${requestId}`)
  setTimeout(() => process.exit(), 5000)
}

export function processStop (socket, requestId, options, count = 0) {
  // check for force option
  if (options.force) return forceStop.call(this, socket, requestId)
  if (_.keys(this.running).length && count <= options.maxWait) {
    return setTimeout(() => processStop.call(this, socket, requestId, options, count++), 1000)
  }
  return forceStop.call(this, socket, requestId)
}

export default function stop (options, socket, requestId) {
  this.log.info({ server: this._server }, 'server stop requested')
  options = !_.isObject(options) ? {} : options
  options.maxWait = isNaN(options.maxWait) ? 30 : Math.round(Number(options.maxWait))

  // set the runner offline so that it will not be scheduled any new tasks
  this.state = OFFLINE

  // check in to update the database
  return this.queries.checkIn()
    .then(() => {
      return processStop.call(this, socket, requestId, options)
    })
    .catch((error) => {
      this.log.error({ server: this._server, error }, 'failed to process stop')
      return processStop.call(this, socket, requestId, options)
    })
}