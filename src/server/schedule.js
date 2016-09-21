import _ from 'lodash'
import factory from 'graphql-factory'
import { EVENTS } from '../common/const'
import RunnerNodeStateEnum from '../graphql/types/RunnerNodeStateEnum'
import RunnerQueueStateEnum from '../graphql/types/RunnerQueueStateEnum'
let { values: { ONLINE } } = RunnerNodeStateEnum
let { values: { SCHEDULED} } = RunnerQueueStateEnum
let { utils: { Enum } } = factory

let { STATUS, SCHEDULE_ERROR, SCHEDULE_ACCEPT, RUN, OK } = EVENTS
let source = 'server/schedule'

// gets the next runner in the list and verifies that it is online
export function getNextRunner (list, success, fail, idx = 0) {
  this.log.trace({ server: this._server, runner: _.get(list, `[${idx}]`) }, 'checking runner')
  if (idx >= list.length) {
    if (this.state === ONLINE) return success(this.info())
    else return fail(new Error('No runners meet the run requirements'))
  }
  let runner = list[idx]
  idx++
  if (runner.id === this.id && this.state === ONLINE) return success(runner)
  if (!runner.host || !runner.port) return getNextRunner.call(this, list, success, fail, idx)

  return this.emit(
    runner.host,
    runner.port,
    STATUS,
    undefined,
    {
      [STATUS]: (info) => {
        if (_.get(info, 'state') !== ONLINE) return getNextRunner.call(this, list, success, fail, idx)
      }
    },
    () => getNextRunner.call(this, list, success, fail, idx)
  )
}

// looks through each runner until it finds one that is online and schedules it
export function checkRunners (context, queue, list, socket) {
  let check = new Promise((resolve, reject) => getNextRunner.call(this, list, resolve, reject))

  this.log.trace({ server: this._server }, 'checking runners for first online')

  return check.then((runner) => {
    return this.queries.updateQueue({
      id: queue.id,
      runner: runner.id,
      state: Enum(SCHEDULED)
    })
      .then(() => {
        this.log.debug({ server: this._server, runner: runner.id, queue: queue.id }, 'successfully scheduled queue')
        this.emit(
          runner.host,
          runner.port,
          RUN,
          undefined,
          {
            [OK]: () => {
              let target = `${runner.host}:${runner.port}`
              this.log.trace({ server: this._server, target }, 'successfully signaled run')
            }
          },
          () => {
            this.log.warn({ server: this._server, target: `${runner.host}:${runner.port}`}, 'run signal failed')
          }
        )
      })
      .catch((error) => {
        this.log.debug({ error, server: this._server, target: `${runner.host}:${runner.port}`}, 'failed to signal run')
      })
  })
}


// schedule a runner
export function setSchedule (action, context, queue, runners, socket) {
  return new Promise((resolve, reject) => {
    try {
      return this.scheduler(this, runners, queue, (error, list) => {
        // check for error
        if (error) {
          this.log.error({ error, source, server: this._server, method: 'setSchedule'}, 'failed to set schedule')
          if (socket) socket.emit(SCHEDULE_ERROR, `failed to schedule ${action} because ${error}`)
          return reject(error)
        }

        // check for runners, if none, try self
        if (!_.isArray(list) || !list.length) {
          this.log.debug({ server: this._server, method: 'setSchedule'}, 'no online runners, trying self')
          if (this.state !== ONLINE) {
            return reject(new Error('No acceptable runners were found'))
          }
          list = [ this.info() ]
        }

        this.log.trace({ server: this._server, method: 'setSchedule'}, 'a list of runners was obtained')

        // check each runner in the list until one that is ONLINE is found
        checkRunners.call(this, context, queue, list, socket)
        return resolve()
      })
    } catch (error) {
      this.log.error({ server: this._server, method: 'setSchedule', error }, 'failed to schedule')
      reject(error)
    }
  })
}

// get a list of online runners
export function getOnlineRunner (action, context, queue, socket) {
  return this.queries.readRunner({ state: Enum(ONLINE) })
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
  if (this.state !== ONLINE) {
    this.log.debug({ server: this._server, state: this.state }, 'denied schedule request')
    if (socket) socket.emit(SCHEDULE_ERROR, `runner in state ${this.state} and cannot schedule tasks`)
    return Promise.reject(`runner in state ${this.state} and cannot schedule tasks`)
  }

  let { action, context } = payload

  // validate that the action is valid
  if (!_.has(this.actions, action)) {
    if (socket) socket.emit(SCHEDULE_ERROR, `${action} is not a known action`)
    this.log.error({ action, source }, 'invalid action requested')
    return Promise.reject('invalid action requested')
  }
  return createQueue.call(this, action, context, socket)
}