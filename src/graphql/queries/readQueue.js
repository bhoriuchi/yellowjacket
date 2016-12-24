import _ from 'lodash'
import obj2arg from 'graphql-obj2arg'

export default function readQueue (args) {
  return this.lib.Yellowjacket(`
  {
    readRunnerQueue (${obj2arg(args, { noOuterBraces: true })})
    {
      id,
      created,
      updated,
      runner,
      state,
      action,
      context
    }
  }`)
    .then((result) => {
      let tasks = _.get(result, 'data.readRunnerQueue')
      if (result.errors) throw new Error(result.errors)
      if (!tasks) throw new Error('No tasks')
      return tasks
    })
}