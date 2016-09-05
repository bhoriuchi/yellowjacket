import chalk from 'chalk'
import _ from 'lodash'
import QueueState from '../graphql/types/RunnerQueueStateEnum'
import { EVENTS } from './const'
import { expandGQLErrors } from './common'
let { SCHEDULED } = QueueState.values
let { OK } = EVENTS
let source = 'server/run.js'

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
      console.log(chalk.blue(JSON.stringify(queue, null, '  ')))
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