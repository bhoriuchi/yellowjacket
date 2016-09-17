import _ from 'lodash'
import fs from 'fs'
import Events from 'events'
import http from 'http'
import SocketServer from 'socket.io'
import SocketClient from 'socket.io-client'
import jwt from 'jsonwebtoken'
import queries from '../graphql/queries/index'
import { LOG_LEVELS, SIGNING_KEY, SIGNING_ALG, EVENTS } from '../common/const'
import basicLogger from '../common/basicLogger'
import startListeners from './startListeners'
import { RunnerNodeStateEnum } from '../graphql/types/index'
let { values: { ONLINE, MAINTENANCE } } = RunnerNodeStateEnum
let { AUTHENTICATE, AUTHENTICATED, TOKEN, DISCONNECT, CONNECT_ERROR, CONNECT_TIMEOUT } = EVENTS

export class YellowJacketServer {
  constructor (backend, actions, scheduler, logger = basicLogger, options = {}) {
    let { host, port, token, socket } = options
    socket = socket || { secure: false, timeout: 2000 }
    token = token || { secret: SIGNING_KEY, algorithm: SIGNING_ALG }
    this.log = logger

    if (!_.isObject(actions) || !_.isFunction(scheduler)) {
      this.log.fatal({}, 'invalid actions or scheduler')
      throw new Error('Invalid actions or scheduler')
    }
    if (!_.isString(host)) {
      this.log.fatal({}, 'host is invalid or not specified')
      throw new Error('host is invalid or not specified')
    }

    // store props
    this.backend = backend
    this.actions = actions
    this.options = options
    this.scheduler = scheduler
    this.queries = queries(this)
    this._logLevel = _.get(LOG_LEVELS, options.loglevel) || 30
    this._lib = backend.lib
    this._host = host
    this._port = port || 8080
    this._server = `${this._host}:${this._port}`
    this._emitter = new Events.EventEmitter()
    this._sockets = {}
    this._socketTimeout = socket.timeout || 2000
    this._secureSocket = Boolean(socket.secure)
    this._running = {}
    this._signingKey = token.secret || token.privateKey ? fs.readFileSync(token.privateKey) : SIGNING_KEY
    this._signingAlg = token.algorithm || SIGNING_ALG
    this._token = jwt.sign({ host: this._host, port: this._port }, this._signingKey, this._signingAlg)

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
        throw err
      })
  }

  startListeners () {
    startListeners.call(this)
  }

  info () {
    return {
      id: this.id,
      host: this._host,
      port: this._port,
      state: this.state,
      running: _.keys(this.running).length
    }
  }

  disconnectSocket (socket) {
    socket.emit(DISCONNECT)
    socket.disconnect(0)
  }

  emit (host, port, event, payload, listener, cb, timeout) {
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
    socket = SocketClient(`http${this._socketSecure ? 's' : ''}://${host}:${port}`, { timeout })

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

  verify (token) {
    try {
      return jwt.verify(token, this._signingKey)
    } catch (error) {
      return { error }
    }
  }

  schedule (payload, socket) {

  }

  run (socket) {

  }

  stop (options, socket) {

  }
}

export default function (backend, actions, scheduler, options) {
  return new YellowJacketServer(backend, actions, scheduler, options)
}