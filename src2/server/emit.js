import _ from 'lodash'
import SocketClient from 'socket.io-client'
import { EVENTS } from '../common/const'
let { AUTHENTICATE, AUTHENTICATED, TOKEN, CONNECT_ERROR, CONNECT_TIMEOUT } = EVENTS

export default function emit (host, port, event, payload, listener, cb, timeout) {
  timeout = timeout || this._socketTimeout

  let handler = (error) => (payload) => {
    if (error) return cb(payload || new Error('unknown handler error'))
    return cb(null, payload)
  }

  // check if emitting to self, if so use local even emitter
  if (host === this._host && port === this._port) return this._emitter.emit(event, payload)

  // check if a socket already exists
  let socket = _.get(this._sockets, `${host}:${port}`)

  // if it does, emit the event
  if (socket) {
    if (!_.has(socket, `listeners["${listener}"]`)) {
      _.set(socket, `listeners["${listener}"]`, handler)
      socket.socket.on(listener, handler())
    }
    return socket.socket.emit(event, payload)
  }

  // if it does not, initiate a connection
  socket = SocketClient(`http${this._secureSocket ? 's' : ''}://${host}:${port}`, { timeout })

  // listen for authentication events
  socket.on(AUTHENTICATE, () => {
    socket.emit(TOKEN, this._token)
  })

  socket.on(AUTHENTICATED, () => {
    _.set(this._sockets, `${host}:${port}`, { socket, listeners: { [listener]: handler } })
    socket.emit(event, payload)
    socket.on(listener, handler())
  })

  // listen for errors
  socket.on(CONNECT_ERROR, () => {
    let s = _.get(this._sockets, `${host}:${port}`)
    if (s) {
      this.disconnectSocket(s.socket)
      delete this._sockets[`${host}:${port}`]
      return handler(true)(new Error('socket.io connection error'))
    }
  })
  socket.on(CONNECT_TIMEOUT, () => {
    let s = _.get(this._sockets, `${host}:${port}`)
    if (s) {
      this.disconnectSocket(s.socket)
      delete this._sockets[`${host}:${port}`]
      return handler(true)(new Error('socket.io connection timeout error'))
    }
  })
}