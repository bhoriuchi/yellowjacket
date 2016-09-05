import _ from 'lodash'
import chalk from 'chalk'
import SocketClient from 'socket.io-client'

export default function (lib, helper) {
  let { error, pretty, options } = helper
  let { id, host, port } = options.options

  let args = ''
  if (id) args = `id: "${id}"`
  else if (host && port) args = `host: "${host}", port: ${port}`
  else return error('Status check requires either a valid ID or hostname, port combo')

  return lib.Runner(`{ readRunner (${args}) { id, host, port } }`)
    .then((res) => {
      let nodeInfo = _.get(res, 'data.readRunner[0]')
      if (res.errors) return error(pretty(res.errors))
      if (!nodeInfo) return error(`Runner not found`)
      let socket = SocketClient(`http://${nodeInfo.host}:${nodeInfo.port}`, { timeout: 2000 })
      socket.on('connected', () => socket.emit('status'))
      socket.on('status', (data) => {
        socket.emit('disconnect')
        console.log(chalk.blue.bold('Node Status:'))
        console.log(chalk.blue(pretty(data)))
        process.exit()
      })
      socket.on('connect_error', () => error('Socket connection error, the runner may not be listening'))
      socket.on('connect_timeout', () => error('Socket connection timeout, the runner may not be listening'))
    })
    .catch(error)
}