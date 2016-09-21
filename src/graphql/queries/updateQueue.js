import _ from 'lodash'
import factory from 'graphql-factory'

export default function updateQueue (args) {
  return this.lib.YJRunner(`mutation Mutation
  {
    updateRunnerQueue (${factory.utils.toObjectString(args, { noOuterBraces: true })})
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