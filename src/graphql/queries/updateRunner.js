import _ from 'lodash'
import obj2arg from 'graphql-obj2arg'

export default function updateRunner (args) {
  return this.lib.Yellowjacket(`mutation Mutation
  {
    updateRunnerNode (${obj2arg(args, { noOuterBraces: true })})
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