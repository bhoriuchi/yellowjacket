import _ from 'lodash'
import fs from 'fs'
import path from 'path'
import Events from 'events'
import http from 'http'
import SocketServer from 'socket.io'
import jwt from 'jsonwebtoken'
import queries from '../graphql/queries/index'
import { LOG_LEVELS, SIGNING_KEY, SIGNING_ALG, EVENTS } from '../common/const'
import basicLogger from '../common/basicLogger'
import startListeners from './startListeners'
import scheduleMethod from './schedule'
import runMethod from './run'
import stopMethod from './stop'
import emitMethod from './emit'
import { RunnerNodeStateEnum } from '../graphql/types/index'
let { values: { ONLINE, MAINTENANCE } } = RunnerNodeStateEnum
let { DISCONNECT } = EVENTS

export class YellowJacketServer {
  constructor (backend, options = {}) {
    let { host, port, token, socket } = options
    socket = socket || { secure: false, timeout: 2000 }
    token = token || { secret: SIGNING_KEY, algorithm: SIGNING_ALG }

    this._logLevel = _.get(LOG_LEVELS, options.loglevel) || 30
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
    this.scheduler = backend.scheduler || function () { return [ this.info() ] }
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
    this._signingKey = token.secret || SIGNING_KEY
    this._signingAlg = token.algorithm || SIGNING_ALG
    if (_.isString(token.privateKey)) this._signingKey = fs.readFileSync(path.resolve(token.privateKey))
    let tokenPayload = { host: this._host, port: this._port }
    let tokenOptions = { algorithm: this._signingAlg }
    this._token = jwt.sign(tokenPayload, this._signingKey, tokenOptions)

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

  info () {
    return {
      id: this.id,
      host: this._host,
      port: this._port,
      state: this.state,
      running: _.keys(this._running).length
    }
  }

  disconnectSocket (socket) {
    socket.emit(DISCONNECT)
    socket.disconnect(0)
  }

  verify (token) {
    try {
      return jwt.verify(token, this._signingKey)
    } catch (error) {
      return { error }
    }
  }
}

export default function (backend, options) {
  return new YellowJacketServer(backend, options)
}