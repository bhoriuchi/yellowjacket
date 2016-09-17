import _ from 'lodash'
import { EVENTS } from '../common/const'
import RunnerNodeStateEnum from '../graphql/types/RunnerNodeStateEnum'
import RunnerQueueStateEnum from '../graphql/types/RunnerQueueStateEnum'
let { values: { ONLINE } } = RunnerNodeStateEnum
let { values: { SCHEDULED} } = RunnerQueueStateEnum

let {
  CONNECTED, CONNECT_ERROR, CONNECT_TIMEOUT, DISCONNECT, STATUS, SCHEDULE_ERROR, SCHEDULE_ACCEPT, RUN, OK
} = EVENTS
let source = 'server/schedule'


export function getNextRunner (list, resolve, reject) {

}

export function checkRunners (context, queue, list, socket) {
  let check = new Promise((resolve, reject) => getNextRunner.call(this, list, resolve, reject))

  return check.then((runner) => {
    return this.queries.updateQueue({
      id: queue.id,
      runner: runner.id,
      state: SCHEDULED
    })
      .then(() => {
        this.log.debug({ server: this._server, runner: runner.id, queue: queue.id }, 'successfully scheduled queue')
        this.emit(runner.host, runner.port, RUN, undefined, OK, (error, success) => {
          if (error) {
            return this.log.warn({ server: this._server, target: `${runner.host}:${runner.port}`}, 'run signal failed')
          }
          this.log.trace({ server: this._server, target: `${runner.host}:${runner.port}`}, 'successfully signaled run')
        })
      })
      .catch((error) => {
        this.log.debug({ error, server: this._server, target: `${runner.host}:${runner.port}`}, 'failed to signal run')
      })
  })
}


// schedule a runner
export function setSchedule (action, context, queue, runners, socket) {
  return new Promise((resolve, reject) => {
    return this.scheduler(this, runners, queue, (error, list) => {

      // check for error
      if (error) {
        this.log.error({ error, source, server: this._server, method: 'setSchedule'}, 'failed to set schedule')
        if (socket) socket.emit(SCHEDULE_ERROR, `failed to schedule ${action} because ${error}`)
        return reject(error)
      }

      // check for runners, if none, try self
      if (!_.isArray(list) || !list.length) {
        if (this.state !== ONLINE) return reject(new Error('No acceptable runners were found'))
        list = [ this.info() ]
      }

      // check each runner in the list until one that is ONLINE is found
      return resolve(checkRunners.call(this, context, queue, list, socket))
    })
  })
}

// get a list of online runners
export function getOnlineRunner (action, context, queue, socket) {
  return this.queries.readRunner({ state: ONLINE })
    .then((runners) => {
      this.log.debug({ server: this._server, source}, 'got online runners')
      return setSchedule.call(this, action, context, queue, runners, socket)
    })
    .catch((error) => {
      this.log.error({ error, source, server: this._server, method: 'getOnlineRunner' }, 'failed to create queue')
      if (socket) return socket.emit(SCHEDULE_ERROR, `failed to schedule ${action}`)
    })
}

// Creates a queue document immediately after receiving it then tries to schedule it
export function createQueue (action, context, socket) {
  return this.queries.createQueue(action, context)
    .then((queue) => {
      this.log.debug({ server: this._server, source }, 'queue created')
      if (socket) socket.emit(SCHEDULE_ACCEPT)
      return getOnlineRunner.call(this, action, context, queue, socket)
    })
    .catch((error) => {
      this.log.error({ error, source, server: this._server, method: 'createQueue' }, 'failed to create queue')
      if (socket) return socket.emit(SCHEDULE_ERROR, `failed to schedule ${action}`)
    })
}


// entry point for schedule request
export default function schedule (payload, socket) {
  let { action, context } = payload

  // validate that the action is valid
  if (!_.has(this.actions, action)) {
    if (socket) socket.emit(SCHEDULE_ERROR, `${action} is not a known action`)
    this.log.error({ action, source }, 'invalid action requested')
    return Promise.reject('invalid action requested')
  }
  return createQueue.call(this, action, context, socket)
}