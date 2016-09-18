import _ from 'lodash'
import SocketClient from 'socket.io-client'
import { EVENTS } from './const'
let { AUTHENTICATE, AUTHENTICATED, TOKEN, CONNECT_ERROR, CONNECT_TIMEOUT } = EVENTS

export default function emit (host, port, event, payload, listeners = {}, errorHandler = () => true, timeout) {
  timeout = timeout || this._socketTimeout

  // check if emitting to self, if so use local even emitter
  if (host === this._host && port === this._port) return this._emitter.emit(event, payload)

  // check if a socket already exists
  let socket = _.get(this._sockets, `${host}:${port}`)

  // if it does, emit the event
  if (socket) {
    _.forEach(listeners, (handler, listener) => {
      if (!_.has(socket, `listeners["${listener}"]`)) {
        _.set(socket, `listeners["${listener}"]`, handler)
        socket.socket.on(listener, handler())
      }
    })
    return socket.socket.emit(event, payload)
  }

  // if it does not, initiate a connection
  socket = SocketClient(`http${this._secureSocket ? 's' : ''}://${host}:${port}`, { timeout })

  // listen for authentication events
  socket.on(AUTHENTICATE, () => {
    socket.emit(TOKEN, this._token)
  })

  socket.on(AUTHENTICATED, () => {
    _.forEach(listeners, (handler, listener) => {
      _.set(this._sockets, `${host}:${port}`, { socket, listeners: { [listener]: handler } })
      socket.on(listener, handler())
    })
    socket.emit(event, payload)
  })

  // listen for errors
  socket.on(CONNECT_ERROR, () => {
    let s = _.get(this._sockets, `${host}:${port}`)
    if (s) {
      this.disconnectSocket(s.socket)
      delete this._sockets[`${host}:${port}`]
      return errorHandler(new Error('socket.io connection error'))
    }
  })
  socket.on(CONNECT_TIMEOUT, () => {
    let s = _.get(this._sockets, `${host}:${port}`)
    if (s) {
      this.disconnectSocket(s.socket)
      delete this._sockets[`${host}:${port}`]
      return errorHandler(new Error('socket.io connection timeout error'))
    }
  })
}