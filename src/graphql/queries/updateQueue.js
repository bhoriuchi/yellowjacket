import _ from 'lodash'
import obj2arg from 'graphql-obj2arg'

export default function updateQueue (args) {
  return this.lib.Yellowjacket(`mutation Mutation
  {
    updateRunnerQueue (${obj2arg(args, { noOuterBraces: true })})
    {
      id,
      runner,
      state,
      action,
      context
    }
  }`)
    .then((result) => {
      let queue = _.get(result, 'data.updateRunnerQueue')
      if (result.errors) throw new Error(result.errors)
      if (!queue) throw new Error('queue not updated')
      return queue
    })
}