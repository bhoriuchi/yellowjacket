import _ from 'lodash'
import QueueState from '../graphql/types/RunnerQueueStateEnum'
import { EVENTS } from './const'
import { expandGQLErrors } from './common'
let { SCHEDULED, RUNNING, FAILED, COMPLETE } = QueueState.values
let { OK } = EVENTS
let source = 'server/run.js'

export function setTaskFailed (id, error) {
  return this._lib.Runner(`mutation Mutation {
    updateQueue (
      id: "${id}",
      state: ${FAILED}
    ) { id }
  }`)
    .then(() => {
      throw error instanceof Error ? error : new Error(error)
    })
    .catch((err) => {
      this.logDebug('Run failed', {
        method: 'setTaskFailed',
        errors: err.message || err,
        stack: err.stack,
        marker: 3,
        source,
        runner: this._id,
        queue: id
      })
    })
}

export function setTaskComplete (id, data) {
  return this._lib.Runner(`mutation Mutation { deleteQueue (id: "${id}") }`)
    .then(() => {
      this.logDebug('Task completed successfully', {
        method: 'run',
        runData: data,
        marker: 4,
        source,
        runner: this._id,
        queue: id
      })
    })
    .catch((err) => {
      this.logDebug('Complete task failed', {
        method: 'run',
        errors: err.message || err,
        stack: err.stack,
        marker: 5,
        source,
        runner: this._id,
        queue: id
      })
    })
}

export function doneTask (taskId) {
  return (err, status, data) => {
    delete this.running[taskId]
    status = _.includes([COMPLETE, FAILED], _.toUpper(status)) ? status : COMPLETE
    data = data || status
    if (err || status === FAILED) return setTaskFailed.call(this, taskId, err || data)
    return setTaskComplete.call(this, taskId, data)
  }
}

export function runTask (task) {
  let { id, action, context } = task
  if (!_.has(this._actions, action)) {
    return this.logError('Requested action is not valid', { action, method: 'runTask', source })
  }
  return this._lib.Runner(`mutation Mutation {
    updateQueue (
      id: "${id}",
      state: ${RUNNING}
    ) { id }
  }`)
    .then((result) => {
      if (result.errors) throw new Error(expandGQLErrors(result.errors))
      try {
        this.running[id] = { action, started: new Date() }
        let taskRun = this._actions[action](this, context, doneTask.bind(this)(id))
        if (_.isFunction(_.get(taskRun, 'then')) && _.isFunction(_.get(taskRun, 'catch'))) {
          return taskRun.then(() => true).catch((err) => {
            throw (err instanceof Error) ? err : new Error(err)
          })
        }
        return taskRun
      } catch (err) {
        throw err
      }
    })
    .catch((err) => {
      delete this.running[id]
      this.logDebug('Run failed', {
        method: 'run',
        errors: err.message || err,
        stack: err.stack,
        marker: 1,
        source,
        runner: this._id,
        queue: id
      })
    })
}

export function getAssigned () {
  return this._lib.Runner(`{
      readQueue (
        runner: "${this._id}",
        state: ${SCHEDULED}
      ) { id, action, context }
    }`)
    .then((result) => {
      let queue = _.get(result, 'data.readQueue')
      if (result.errors) throw new Error(expandGQLErrors(result.errors))
      _.forEach(queue, (task) => runTask.call(this, task))
    })
    .catch((err) => {
      this.logDebug('Failed query run queue', {
        method: 'run',
        errors: err.message || err,
        stack: err.stack,
        marker: 2,
        source
      })
    })
}

export function run (socket) {
  return () => {
    this.logTrace('Checking queue')
    if (socket) socket.emit(OK)
    return getAssigned.call(this)
  }
}

export default run