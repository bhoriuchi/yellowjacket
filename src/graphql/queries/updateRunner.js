import _ from 'lodash'
import factory from 'graphql-factory'

export default function updateRunner (args) {
  return this.lib.YJRunner(`mutation Mutation
  {
    updateRunnerNode (${factory.utils.toObjectString(args, { noOuterBraces: true })})
    {
      id,
      host,
      port,
      zone { id, name, description, metadata },
      state,
      metadata
    }
  }`)
    .then((result) => {
      let runner = _.get(result, 'data.updateRunnerNode')
      if (result.errors) throw new Error(result.errors)
      if (!runner) throw new Error('runner not updated')
      return runner
    })
}