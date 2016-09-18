import _ from 'lodash'
import factory from 'graphql-factory'

export default function createRunner (args) {
  return this.lib.YJRunner(`mutation Mutation
  {
    createRunnerNode (${factory.utils.toObjectString(args, { noOuterBraces: true })})
    {
      id,
      host,
      port,
      state,
      zone { id, name },
      metadata
    }
  }`)
    .then((result) => {
      let runner = _.get(result, 'data.createRunnerNode')
      if (result.errors) throw result.errors
      if (!runner) throw new Error('runner not created')
      return runner
    })
}