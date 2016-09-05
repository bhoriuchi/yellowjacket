import chalk from 'chalk'
import _ from 'lodash'
import QueueState from '../graphql/types/RunnerQueueStateEnum'
import { EVENTS } from './const'
import { expandGQLErrors } from './common'
let { SCHEDULED, RUNNING } = QueueState.values
let { OK } = EVENTS
let source = 'server/run.js'

export function doneTask (err, status) {
  if (err) return console.log('got an error')
  return console.log('finished task')
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
      return this._actions[action](this, context, doneTask)
    })
    .catch((err) => {
      this.logDebug('Failed to update queue', {
        method: 'runTask',
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
      // console.log(chalk.blue(JSON.stringify(queue, null, '  ')))
      _.forEach(queue, (task) => runTask.call(this, task))
    })
    .catch((err) => {
      this.logDebug('Failed query run queue', {
        method: 'run',
        errors: err.message || err,
        stack: err.stack,
        marker: 1,
        source
      })
    })
}

export function run (socket) {
  return () => {
    if (socket) socket.emit(OK)
    console.log(chalk.bold.blue('check run queue'))
    return getAssigned.call(this)
  }
}

export default run