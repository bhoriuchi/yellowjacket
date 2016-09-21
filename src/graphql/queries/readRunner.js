import _ from 'lodash'
import factory from 'graphql-factory'

export default function readRunner (args) {

  let filter = _.isObject(args) ? `(${factory.utils.toObjectString(args, { noOuterBraces: true })})` : ''

  return this.lib.YJRunner(`
  {
    readRunnerNode ${filter}
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
      let runners = _.get(result, 'data.readRunnerNode')
      if (result.errors) throw new Error(result.errors)
      if (!runners) throw new Error('No runners')
      return runners
    })
}