import _ from 'lodash'
import SocketClient from 'socket.io-client'
import { EVENTS } from './const'
let { AUTHENTICATE, AUTHENTICATED, AUTHENTICATION_ERROR, TOKEN, CONNECT_ERROR, CONNECT_TIMEOUT } = EVENTS

export default function emit (host, port, event, payload, listeners = {}, errorHandler = () => true, timeout) {
  this.log.debug({ emitter: this._server, target: `${host}:${port}`, event }, 'emitting event')
  timeout = timeout || this._socketTimeout

  // check if emitting to self, if so use local even emitter
  if (host === this._host && port === this._port) return this._emitter.emit(event, payload)

  // check if a socket already exists
  let socket = _.get(this._sockets, `${host}:${port}`)

  // if it does, emit the event
  if (socket) {
    this.log.trace({ emitter: this._server }, 'socket found')
    _.forEach(listeners, (handler, listener) => {
      if (!_.has(socket, `listeners["${listener}"]`)) {
        this.log.trace({ emitter: this._server, listener }, 'adding new listener')
        _.set(this._sockets, `["${host}:${port}"].listeners["${listener}"]`, handler)
        socket.socket.on(listener, () => handler(socket))
      }
    })
    return socket.socket.emit(event, payload)
  }

  this.log.trace({ emitter: this._server }, 'creating a new socket')

  // if it does not, initiate a connection
  socket = SocketClient(`http${this._secureSocket ? 's' : ''}://${host}:${port}`, { timeout })
  _.set(this._sockets, `["${host}:${port}"]`, { socket, listeners: {} })

  // listen for authentication events
  socket.on(AUTHENTICATE, () => {
    this.log.trace({ emitter: this._server }, 'got authentication request, emitting token')
    socket.emit(TOKEN, this._token)
  })

  socket.on(AUTHENTICATED, () => {
    _.forEach(listeners, (handler, listener) => {
      this.log.trace({ emitter: this._server, listener }, 'adding new listener')
      _.set(this._sockets, `["${host}:${port}"].listeners["${listener}"]`, handler)
      socket.on(listener, () => handler(socket))
    })
    socket.emit(event, payload)
  })

  // authentication error
  socket.on(AUTHENTICATION_ERROR, (error) => {
    this.log.trace({ emitter: this._server, error }, 'authentication error')
    this.disconnectSocket(host, port)
    return errorHandler(error)
  })

  // listen for errors
  socket.on(CONNECT_ERROR, () => {
    let s = _.get(this._sockets, `${host}:${port}`)
    if (s) {
      this.disconnectSocket(host, port)
      return errorHandler(new Error('socket.io connection error'))
    }
  })
  socket.on(CONNECT_TIMEOUT, () => {
    let s = _.get(this._sockets, `${host}:${port}`)
    if (s) {
      this.disconnectSocket(host, port)
      return errorHandler(new Error('socket.io connection timeout error'))
    }
  })
}