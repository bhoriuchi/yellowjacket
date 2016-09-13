import _ from 'lodash'
import SocketClient from 'socket.io-client'

export default function (lib, helper) {
  let resolveArgs = new Promise((resolve, reject) => {

    let { error, pretty, options, terminate } = helper
    let { id, host, port, action, context } = options.options
    context = context || {}
    let args = ''
    if (id) args = `id: "${id}"`
    else if (host && port) args = `host: "${host}", port: ${port}`
    else return reject('Schedule requires either a valid ID or hostname, port combo')
    if (!action) return reject('No action specified')
    return resolve({ args, context, pretty, action, terminate })
  })

  return resolveArgs.then(({ args, context, pretty, action, terminate }) => {
    let timeout = 2000
    return lib.Runner(`{ readRunner (${args}) { id, host, port } }`)
      .then((res) => {
        return new Promise((resolve, reject) => {
          let disconnected = false
          let nodeInfo = _.get(res, 'data.readRunner[0]')
          if (res.errors) return reject(pretty(res.errors))
          if (!nodeInfo) return reject(`Runner not found`)

          let uri = `http://${nodeInfo.host}:${nodeInfo.port}`
          let socket = SocketClient(uri, { timeout })

          setTimeout(() => {
            if (!disconnected) {
              socket.emit('disconnect')
              socket.disconnect(0)
              reject('Fallback timeout reached')
              if (terminate) process.exit()
            }
          }, timeout)

          socket.on('connected', () => {
            socket.emit('schedule', { action, context })
          })

          socket.on('schedule.accept', () => {
            disconnected = true
            socket.emit('disconnect')
            socket.disconnect(0)
            resolve('Accepted schedule request')
            if (terminate) process.exit()
          })

          socket.on('schedule.error', (err) => {
            disconnected = true
            socket.emit('disconnect')
            socket.disconnect(0)
            reject(err)
            if (terminate) process.exit()
          })

          socket.on('connect_error', () => {
            socket.emit('disconnect')
            disconnected = true
            socket.disconnect(0)
            reject('Schedule error')
            if (terminate) process.exit()
          })
          socket.on('connect_timeout', () => {
            disconnected = true
            socket.emit('disconnect')
            socket.disconnect(0)
            reject('Schedule error')
            if (terminate) process.exit()
          })
        })
      })
  })
  //.catch(error)
}