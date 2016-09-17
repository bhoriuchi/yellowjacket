import _ from 'lodash'
import { EVENTS } from '../common/const'
import RunnerNodeStateEnum from '../graphql/types/RunnerNodeStateEnum'
let { values: { ONLINE } } = RunnerNodeStateEnum

let {
  CONNECTED, CONNECT_ERROR, CONNECT_TIMEOUT, DISCONNECT, STATUS, SCHEDULE_ERROR, SCHEDULE_ACCEPT, RUN, OK
} = EVENTS
let source = 'server/schedule'


export function getNextRunner (list, resolve, reject) {

}

export function checkRunners (list) {
  let check = new Promise((resolve, reject) => getNextRunner.call(this, list, resolve, reject))

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
      return resolve(checkRunners.call(this, list))
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