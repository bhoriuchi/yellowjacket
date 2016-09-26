import _ from 'lodash'

export default function deleteRunner (id) {
  return this.lib.YJRunner(`mutation Mutation
  {
    deleteRunnerNode (id: "${id}")
  }`)
    .then((result) => {
      let runner = _.get(result, 'data.deleteRunnerNode')
      if (result.errors) throw new Error(result.errors)
      if (!runner) throw new Error('runner not deleted')
      return runner
    })
}