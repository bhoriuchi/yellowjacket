import Server from '../server'
import { DEFAULT_HTTP_PORT } from './common'

export default function (lib, helper, actions, scheduler) {
  let { error, options } = helper
  let { host, port } = options.options
  helper.options.options.port = port || DEFAULT_HTTP_PORT
  if (!host) return error('No host option was specified', true)
  return new Server(lib, helper, actions, scheduler)
}