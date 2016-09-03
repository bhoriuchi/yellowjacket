import _ from 'lodash'

let query = '{ readRunner { id, host, port, zone { id, name, description, metadata }, state, metadata } }'

export default function getRunner () {
  return this._lib.Runner(query)
    .then((results) => {
      let [ host, port ] = [ this._host, this._port ]
      let runners = _.get(results, 'data.readRunner', [])
      let config = _.filter(runners, { host, port })
      if (results.errors) throw new Error(results.errors)
      if (!config.length) return this._error(`The host:port ${host}:${port} has not been added yet`, true)
      return { runners, runner: config[0] }
    })
}