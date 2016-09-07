import _ from 'lodash'
import SocketClient from 'socket.io-client'

export default function (lib, helper) {
  let { error, pretty, options, terminate } = helper
  let { id, host, port, action, context } = options.options
  context = context || {}
  let args = ''
  if (id) args = `id: "${id}"`
  else if (host && port) args = `host: "${host}", port: ${port}`
  else return error('Schedule requires either a valid ID or hostname, port combo')
  if (!action) return error('No action specified')

  return lib.Runner(`{ readRunner (${args}) { id, host, port } }`)
    .then((res) => {
      let nodeInfo = _.get(res, 'data.readRunner[0]')
      if (res.errors) return error(pretty(res.errors))
      if (!nodeInfo) return error(`Runner not found`)
      let socket = SocketClient(`http://${nodeInfo.host}:${nodeInfo.port}`, { timeout: 2000 })
      socket.on('connected', () => socket.emit('schedule', { action, context }))

      socket.on('schedule.accept', () => {
        console.log('Accepted schedule request')
        socket.emit('disconnect')
        socket.disconnect(0)
        if (terminate) process.exit()
      })

      socket.on('schedule.error', (err) => {
        console.log('Schedule Error')
        console.log(err)
        socket.emit('disconnect')
        socket.disconnect(0)
        if (terminate) process.exit()
      })

      socket.on('connect_error', () => {
        console.log('connection error')
        socket.emit('disconnect')
        socket.disconnect(0)
        if (terminate) process.exit()
      })
      socket.on('connect_timeout', () => {
        console.log('timed out')
        socket.emit('disconnect')
        socket.disconnect(0)
        if (terminate) process.exit()
      })
    })
    .catch(error)
}