import _ from 'lodash'
import Events from 'events'
import tokenStore from '../common/token'
import emitMethod from '../common/emit'
import basicLogger from '../common/basicLogger'
import { LOG_LEVELS, EVENTS } from '../common/const'
let { DISCONNECT, OK } = EVENTS

export class YellowjacketClient {
  constructor (backend, options = {}) {
    let { socket, token, host, port } = options

    this._logLevel = _.get(LOG_LEVELS, options.loglevel) || LOG_LEVELS.info
    this.log = backend.logger || basicLogger.call(this)

    socket = socket || {}
    this._emitter = new Events.EventEmitter()
    this._host = host || 'localhost'
    this._port = port || 1
    this._tokenStore = tokenStore(this._host, this._port, token)
    this._token = this._tokenStore.token
    this._sockets = {}
    this._socketTimeout = socket.timeout || 2000
    this._secureSocket = Boolean(socket.secure)
  }

  emit (host, port, event, payload, listener, cb, timeout) {
    return emitMethod.call(this, host, port, event, payload, listener, cb, timeout)
  }

  disconnect (host, port) {
    this.emit(host, port, DISCONNECT, undefined, OK, () => true, 500)
    delete this._sockets[`${host}:${port}`]
  }
}

export default function (backend, options = {}) {
  return new YellowjacketClient(backend, options)
}