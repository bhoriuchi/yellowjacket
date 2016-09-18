import _ from 'lodash'
import RunnerQueueStateEnum from '../graphql/types/RunnerQueueStateEnum'
let { values: { SCHEDULED, RUNNING, FAILED, COMPLETE } } = RunnerQueueStateEnum

// marks failed tasks and logs the error
export function setTaskFailed (id, error) {
  return this.queries.updateQueue({ id, state: FAILED })
    .then(() => {
      throw error instanceof Error ? error : new Error(error)
    })
    .catch((error) => {
      this.log.error({ server: this._server, error, task: id }, 'task failed')
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
  let { id, action, context } = task
  if (!_.has(this.actions, action)) return this.log.error({ server: this._server, action }, 'action is not valid')

  return this.queries.updateQueue({ id, state: RUNNING })
    .then(() => {
      this._running[id] = { action, started: new Date() }
      let taskRun = this.actions[action](this, context, doneTask.call(this, id))
      if (this.isPromise(taskRun)) {
        return taskRun.then(() => true).catch((error) => {
          throw (error instanceof Error) ? error : new Error(error)
        })
      }
      return taskRun
    })
    .catch((error) => {
      this.log.error({ server: this._server, action, error }, 'failed to update the queue')
    })
}

// gets the tasks assigned to this runner
export function getAssigned () {
  return this.queries.readQueue({
    runner: this.id,
    state: SCHEDULED
  })
    .then((tasks) => {
      this.log.trace({ server: this._server }, 'acquired tasks')
      _.forEach(tasks, (task) => runTask.call(this, task))
    })
    .catch((error) => {
      this.log.debug({ server: this._server, error }, 'failed to get assigned tasks')
    })
}

// checks for assigned tasks and attempts to run them
export default function run (socket) {
  return () => {
    this.log.trace({ server: this._server }, 'checking queue')
    if (socket) socket.emit(OK)
    return getAssigned.call(this)
  }
}