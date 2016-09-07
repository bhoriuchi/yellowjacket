import _ from 'lodash'
import Server from '../server/index'
import { DEFAULT_HTTP_PORT } from './common'

export default function (lib, helper, actions, scheduler) {
  let { error, options, backend } = helper
  if (!options || !_.has(options, 'options')) return error('Invalid options')
  let { host, port } = options.options
  helper.options.options.port = port || DEFAULT_HTTP_PORT
  if (!host) return error('No host option was specified', true)
  return new Server(backend, lib, helper.options.options, actions, scheduler)
}