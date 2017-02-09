import _ from 'lodash'
import { EVENTS } from '../common/const'
import RunnerNodeStateEnum from '../graphql/types/RunnerNodeStateEnum'
import RunnerQueueStateEnum from '../graphql/types/RunnerQueueStateEnum'
let { values: { ONLINE } } = RunnerNodeStateEnum
let { values: { SCHEDULED, RUNNING, FAILED, COMPLETE } } = RunnerQueueStateEnum
let { SCHEDULE_ERROR, OK } = EVENTS

// marks failed tasks and logs the error
export function setTaskFailed (id, error) {
  return this.queries.updateQueue({ id, state: `Enum::${FAILED}` })
    .then(() => {
      this.log.error({ server: this._server, error, task: id }, 'task failed')
    })
    .catch((error) => {
      this.log.error({ server: this._server, error, task: id }, 'fail status update failed')
    })
}

// removes the task on successful completion
export function setTaskComplete (id, data) {
  return this.queries.deleteQueue(id)
    .then(() => {
      this.log.debug({ server: this._server, task: id, runData: data }, 'task completed successfully')
    })
    .catch((error) => {
      this.log.error({ server: this._server, error }, 'failed to set task complete')
    })
}

// returns an error first callback that is called by the action when done
export function doneTask (taskId) {
  return (err, status, data) => {
    delete this._running[taskId]
    status = _.includes([COMPLETE, FAILED], _.toUpper(status)) ? status : COMPLETE
    data = data || status
    if (err || status === FAILED) return setTaskFailed.call(this, taskId, err || data)
    return setTaskComplete.call(this, taskId, data)
  }
}

// runs the task/action
export function runTask (task) {
  let { id, action } = task
  if (!_.has(this.actions, action)) return this.log.error({ server: this._server, action }, 'action is not valid')

  // add the task to the running object to prevent duplicate runs and potentially use for load balancing
  this._running[id] = { action, started: new Date() }

  return this.queries.updateQueue({ id, state: `Enum::${RUNNING}` })
    .then(() => {
      try {
        let taskRun = this.actions[action](this, task, doneTask.call(this, id))
        if (this.isPromise(taskRun)) {
          return taskRun.then(() => true).catch((error) => {
            return setTaskFailed.call(this, id, (error instanceof Error) ? error : new Error(error))
          })
        }
        return taskRun
      } catch (err) {
        return setTaskFailed.call(this, id, err)
      }
    })
    .catch((error) => {
      this.log.error({ server: this._server, action, error }, 'failed to update the queue')
      return setTaskFailed.call(this, id, error)
    })
}

// resumes a task
export function resumeTask (taskId, data) {
  return this.queries.readQueue({ id: taskId })
    .then((tasks) => {
      let task = _.get(tasks, '[0]')
      if (!task) throw new Error(`task ${taskId} not found`)
      return runTask.call(this, _.merge({}, task, { resume: true, data }))
    })
}

// gets the tasks assigned to this runner
export function getAssigned () {
  return this.queries.readQueue({ runner: this.id, state: `Enum::${SCHEDULED}` })
    .then((tasks) => {
      this.log.trace({ server: this._server }, 'acquired tasks')
      _.forEach(tasks, (task) => {
        // do not run the task if its already running
        if (!_.has(this._running, task.id)) runTask.call(this, task)
      })
    })
    .catch((error) => {
      this.log.debug({ server: this._server, error }, 'failed to get assigned tasks')
    })
}

// checks for assigned tasks and attempts to run them
export default function run (socket, requestId) {
  if (this.state !== ONLINE) {
    this.log.debug({ server: this._server, state: this.state }, 'denied run request')
    this.send(`${SCHEDULE_ERROR}.${requestId}`, `runner in state ${this.state} and cannot run tasks`, socket)
    return Promise.reject(`runner in state ${this.state} and cannot run tasks`)
  }

  this.log.trace({ server: this._server }, 'checking queue')
  this.send(`${OK}.${requestId}`, undefined, socket)
  return getAssigned.call(this)
}