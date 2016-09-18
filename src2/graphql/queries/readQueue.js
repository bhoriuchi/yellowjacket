import factory from 'graphql-factory'

export default function readRunner (args) {
  return this._lib.YJRunner(`
  {
    readRunnerQueue (${factory.utils.toObjectString(args, { noOuterBraces: true })})
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
      return runners
    })
}