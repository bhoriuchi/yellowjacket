import _ from 'lodash'
import SocketClient from 'socket.io-client'
import { toLiteralJSON } from '../server/common'

export default function stop (lib, helper) {
  let { error, options } = helper
  let opts = options.options
  if (!opts) return error('No options specified')

  let args = _.trim(_.trim(toLiteralJSON(opts), '{'), '}')

  return lib.Runner(`{
    readRunner (${args}) { id, host, port }
  }`)
    .then((result) => {
      let runner = _.get(result, 'data.readRunner[0]')
      if (result.errors || !runner) return error(result.errors || 'Could not find runner')

      let socket = SocketClient(`http://${runner.host}:${runner.port}`, { timeout: 2000 })
      socket.on('connected', () => socket.emit('stop'))
      socket.on('ok', (data) => {
        socket.emit('ok')
        socket.emit('disconnect')
        process.exit()
      })
      socket.on('connect_error', () => error('Socket connection error, the runner may not be listening'))
      socket.on('connect_timeout', () => error('Socket connection timeout, the runner may not be listening'))

    })
    .catch((err) => error)

}