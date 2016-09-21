import _ from 'lodash'
import Events from 'events'
import http from 'http'
import SocketServer from 'socket.io'
import queries from '../graphql/queries/index'
import { LOG_LEVELS, EVENTS } from '../common/const'
import tokenStore from '../common/token'
import basicLogger from '../common/basicLogger'
import startListeners from './startListeners'
import scheduleMethod from './schedule'
import maintenanceMethod from './maintenance'
import runMethod from './run'
import stopMethod from './stop'
import emitMethod from '../common/emit'
import { RunnerNodeStateEnum } from '../graphql/types/index'
let { values: { ONLINE, MAINTENANCE } } = RunnerNodeStateEnum
let { DISCONNECT } = EVENTS

export class YellowJacketServer {
  constructor (backend, options = {}) {
    let { host, port, token, socket } = options
    socket = socket || { secure: false, timeout: 2000 }
    // token = token || { secret: SIGNING_KEY, algorithm: SIGNING_ALG }

    this._logLevel = _.get(LOG_LEVELS, options.loglevel) || LOG_LEVELS.info
    this.log = backend.logger || basicLogger.call(this)

    if (!backend) {
      this.log.fatal({}, 'no backend provided')
      throw new Error('No backend provided')
    }
    if (!_.isObject(backend.actions)) {
      this.log.fatal({}, 'invalid actions')
      throw new Error('Invalid actions')
    }
    if (!_.isString(host)) {
      this.log.fatal({}, 'host is invalid or not specified')
      throw new Error('host is invalid or not specified')
    }

    // store props
    this.backend = backend
    this.actions = backend.actions
    this.options = options
    this.scheduler = backend.scheduler || this.defaultScheduler
    this.queries = queries(this)
    this.lib = backend.lib
    this._host = host
    this._port = port || 8080
    this._server = `${this._host}:${this._port}`
    this._emitter = new Events.EventEmitter()
    this._sockets = {}
    this._socketTimeout = socket.timeout || 2000
    this._secureSocket = Boolean(socket.secure)
    this._running = {}

    // token settings and creation
    this._tokenStore = tokenStore(this._host, this._port, token)
    this._token = this._tokenStore.token

    // get the global settings
    return this.queries.getSettings()
      .then((settings) => {
        this._appName = settings.appName
        this._checkinFrequency = settings.checkinFrequency
        this._offlineAfterPolls = settings.offlineAfterPolls
        this._offlineAfter = this._checkinFrequency * this._offlineAfterPolls

        this.log.info({ server: this._server }, 'starting server')

        // get self
        return this.queries.getSelf()
          .then((self) => {
            this.id = self.id
            this.state = self.state === MAINTENANCE ? MAINTENANCE : ONLINE

            // check in
            return this.queries.checkIn(true)
              .then(() => {
                // set up socket.io server
                this._app = http.createServer((req, res) => {
                  res.writeHead(200)
                  res.end(`${this._server}`)
                })
                this._app.listen(port)
                this._io = new SocketServer(this._app)

                // if the state is online start the listeners
                if (this.state === ONLINE) this.startListeners()
              })
          })

      })
      .catch((error) => {
        this.log.fatal({ server: this._server, error }, 'the server failed to start')
        throw error
      })
  }

  isPromise (obj) {
    return _.isFunction(_.get(obj, 'then')) && _.isFunction(_.get(obj, 'catch'))
  }

  startListeners () {
    startListeners.call(this)
  }

  emit (host, port, event, payload, listener, cb, timeout) {
    return emitMethod.call(this, host, port, event, payload, listener, cb, timeout)
  }

  schedule (payload, socket) {
    return scheduleMethod.call(this, payload, socket)
  }

  run (socket) {
    return runMethod.call(this, socket)
  }

  stop (options, socket) {
    return stopMethod.call(this, options, socket)
  }

  maintenance (enter, socket) {
    return maintenanceMethod.call(this, enter, socket)
  }

  info () {
    return {
      id: this.id,
      host: this._host,
      port: this._port,
      state: this.state,
      running: _.keys(this._running).length
    }
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

  defaultScheduler (backend, runners, queue, done) {
    return done(null, [ this.info() ] )
  }

  verify (token) {
    return this._tokenStore.verify(token)
  }
}

export default function (backend, options) {
  return new YellowJacketServer(backend, options)
}