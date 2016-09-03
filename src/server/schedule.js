import _ from 'lodash'
import QueueState from '../graphql/types/RunnerQueueStateEnum'
let { UNSCHEDULED } = QueueState.values

export default function schedule (socket, action, context) {
  if (!_.has(this._actions, action)) {
    socket.emit('schedule.error', `${action} is not a known action`)
    this.logError('Invalid action requested', { action })
    return new Promise((resolve, reject) => reject('Invalid action requested'))
  }

  return this._lib.Runner(`mutation Mutation {
  createQueue (
    action: "${action}",
    context: "${JSON.stringify(context)}",
    state: ${UNSCHEDULED}
  ) {
    id
  }  
}`)
    .then(() => {
      let runner = _.get(result, 'data.createQueue')
      if (result.errors || !runner) return socket.emit('schedule.error', `failed to schedule ${action}`)
    })
}