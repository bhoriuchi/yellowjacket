import _ from 'lodash'
import obj2arg from 'graphql-obj2arg'

export default function createRunner (args) {
  return this.lib.Yellowjacket(`mutation Mutation
  {
    createRunnerNode (${obj2arg(args, { noOuterBraces: true })})
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