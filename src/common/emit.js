import _ from 'lodash'
import hat from 'hat'
import SocketClient from 'socket.io-client'
import { EVENTS } from './const'
let {
  CONNECT, UNAUTHORIZED, AUTHENTICATE, AUTHENTICATED, AUTHENTICATION_ERROR, TOKEN, CONNECT_ERROR, CONNECT_TIMEOUT, TOKEN_EXPIRED_ERROR
} = EVENTS

export function addListeners (socket, listeners, requestId) {
  _.forEach(listeners, (handler, name) => {
    let evt = `${name}.${requestId}`
    this.log.trace({ emitter: this._server, eventName: evt }, 'adding new socket event listener')
    socket.once(evt, (payload) => {
      handler.call(this, { requestId, payload, socket })
    })
  })
}

export default function emit (host, port, event, payload, listeners = {}, errorHandler = () => true, timeout) {
  let requestId = hat()

  timeout = timeout || this._socketTimeout

  // proactively renew the token if it is expired
  this._token = this._tokenStore.renewIfExpired()

  // check if emitting to self, if so use local even emitter
  if (host === this._host && port === this._port) return this._emitter.emit(event, payload)

  // check if a socket already exists
  let socket = _.get(this._sockets, `${host}:${port}`)

  // if it does, emit the event
  if (socket) {
    this.log.trace({ emitter: this._server }, 'socket found')
    addListeners.call(this, socket, listeners, requestId)
    this.log.debug({ emitter: this._server, target: `${host}:${port}`, event }, 'emitting event on EXISTING connection')
    return socket.emit(event, { payload, requestId })
  }

  this.log.trace({ emitter: this._server }, 'creating a new socket')

  // if it does not, initiate a connection
  socket = SocketClient(`http${this._secureSocket ? 's' : ''}://${host}:${port}`, { timeout })
  _.set(this._sockets, `["${host}:${port}"]`, socket)

  socket.on(CONNECT, () => {
    socket.emit(AUTHENTICATE, { token: this._token })
      .on(AUTHENTICATED, () => {
        addListeners.call(this, socket, listeners, requestId)
        this.log.debug({ emitter: this._server, target: `${host}:${port}`, event }, 'emitting event on NEW connection')
        socket.emit(event, { payload, requestId })
      })
      .on(UNAUTHORIZED, (msg) => {
        console.log('unauth', msg)
      })
  })

  // listen for authentication events
  /*
  socket.on(AUTHENTICATE, () => {
    this.log.trace({ emitter: this._server }, 'got authentication request, emitting token')
    socket.emit(TOKEN, this._token)
  })

  // renew token if expired
  socket.on(TOKEN_EXPIRED_ERROR, () => {
    this.log.trace({ emitter: this._server }, 'renewing expired token')
    socket.emit(TOKEN, this.renewToken())
  })

  socket.on(AUTHENTICATED, () => {
    addListeners.call(this, socket, listeners, requestId)
    this.log.debug({ emitter: this._server, target: `${host}:${port}`, event }, 'emitting event on NEW connection')
    socket.emit(event, { payload, requestId })
  })

  // authentication error
  socket.on(AUTHENTICATION_ERROR, (error) => {
    this.log.trace({ emitter: this._server, error }, 'authentication error')
    this.disconnectSocket(host, port)
    return errorHandler(error)
  })
  */

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