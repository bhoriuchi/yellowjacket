import _ from 'lodash'
import factory from 'graphql-factory'
import RunnerQueueStateEnum from '../types/RunnerQueueStateEnum'
let { values: { UNSCHEDULED } } = RunnerQueueStateEnum

export default function createQueue (action, context) {
  return this.lib.YJRunner(`mutation Mutation 
    {
      createRunnerQueue (
        action: "${action}",
        context: ${factory.utils.toObjectString(context)},
        state: ${UNSCHEDULED}
      ) {
        id,
        action,
        context
      }  
    }`)
    .then((result) => {
      let queue = _.get(result, 'data.createRunnerQueue')
      if (result.errors) throw new Error(result.errors)
      if (!queue) throw new Error('Could not create queue')
      return queue
    })
}