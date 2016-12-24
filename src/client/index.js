import _ from 'lodash'
import Events from 'events'
import tokenStore from '../common/token'
import emitMethod from '../common/emit'
import basicLogger from '../common/basicLogger'
import CONST from '../common/const'
import { LOG_LEVELS, EVENTS } from '../common/const'
let { DISCONNECT, OK } = EVENTS

export default class YellowjacketClient {
  constructor (backend, options = {}) {
    let { socket, token, host, port } = options

    this._logLevel = _.get(LOG_LEVELS, options.loglevel) || LOG_LEVELS.info
    this.log = backend.logger || basicLogger.call(this)

    socket = socket || {}
    this.CONST = CONST
    this._backend = backend
    this._emitter = new Events.EventEmitter()
    this._host = host || 'localhost'
    this._port = port || 8080
    this._server = `${this._host}:${this._port}`
    this._tokenStore = tokenStore(this._host, this._port, token)
    this._token = this._tokenStore.token
    this._sockets = {}
    this._socketTimeout = socket.timeout || 2000
    this._secureSocket = Boolean(socket.secure)
  }

  emit (host, port, event, payload, listener, cb, timeout) {
    return emitMethod.call(this, host, port, event, payload, listener, cb, timeout)
  }

  renewToken () {
    this._tokenStore.renew()
    this._token = this._tokenStore.token
    return this._token
  }

  disconnectSocket (host, port) {
    this.log.debug({ server: this._server, target: `${host}:${port}`}, 'disconnecting socket')
    this.emit(host, port, DISCONNECT, undefined, OK, () => true, 500)
    let s = _.get(this._sockets, `["${host}:${port}"].socket`)
    if (s) {
      this._sockets[`${host}:${port}`].socket.disconnect(0)
      delete this._sockets[`${host}:${port}`]
    }
  }
}