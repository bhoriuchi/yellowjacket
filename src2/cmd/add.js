import _ from 'lodash'

export function addRunner (args) {
  if (!_.isObject(args)) throw new Error('No options provided')
  let { host, port, zone, metadata } = args
  let payload = _.omitBy({ host, port, zone, metadata }, (v) => v === undefined)
  return this.queries.createRunner(payload)
}

export default {
  addRunner
}