import _ from 'lodash'

export default function deleteQueue (id) {
  return this.lib.Yellowjacket(`mutation Mutation
  {
    deleteRunnerQueue (id: "${id}")
  }`)
    .then((result) => {
      let queue = _.get(result, 'data.deleteRunnerQueue')
      if (result.errors) throw new Error(result.errors)
      if (!queue) throw new Error('queue not deleted')
      return queue
    })
}