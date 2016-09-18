import _ from 'lodash'
import RunnerNodeStateEnum from '../graphql/types/RunnerNodeStateEnum'
import { EVENTS } from '../common/const'
let { OK } = EVENTS
let { values: { OFFLINE } } = RunnerNodeStateEnum

export function forceStop (socket) {
  // send an ok response to cleanly exit
  // but also set a timeout for 5 seconds to ensure the process exits
  if (socket) socket.emit(OK)
  if (socket) socket.on(OK, () => process.exit())
  setTimeout(() => process.exit(), 5000)
}

export function processStop (socket, options, count = 0) {
  // check for force option
  if (options.force) return forceStop(socket)
  if (_.keys(this.running).length && count <= options.maxWait) {
    return setTimeout(() => processStop.call(this, socket, options, count++), 1000)
  }
  return forceStop(socket)
}

export default function stop (options = {}, socket) {
  this.logInfo('Server stop requested')
  options.maxWait = isNaN(options.maxWait) ? 30 : Math.round(Number(options.maxWait))

  // set the runner offline so that it will not be scheduled any new tasks
  this.state = OFFLINE

  // check in to update the database
  return this.queries.checkIn()
    .then(() => processStop.call(this, socket, options))
    .catch(() => processStop.call(this, socket, options))
}