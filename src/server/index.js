import _ from 'lodash'
import os from 'os'
import Events from 'events'
import http from 'http'
import SocketServer from 'socket.io'
import queries from '../graphql/queries/index'
import CONST from '../common/const'
import { LOG_LEVELS, EVENTS } from '../common/const'
import tokenStore from '../common/token'
import basicLogger from '../common/basicLogger'
import startListeners from './startListeners'
import { addListeners } from './startListeners'
import scheduleMethod from './schedule'
import maintenanceMethod from './maintenance'
import runMethod from './run'
import { doneTask, resumeTask } from './run'
import stopMethod from './stop'
import emitMethod from '../common/emit'
import { RunnerNodeStateEnum } from '../graphql/types/index'
let { values: { ONLINE, MAINTENANCE } } = RunnerNodeStateEnum
let { DISCONNECT, RUN } = EVENTS

export class YellowJacketServer {
  constructor (backend, options = {}) {
    let { host, port, token, socket, server } = options
    socket = socket || { secure: false, timeout: 2000 }
    server = server || {}

    backend._logLevel = this._logLevel = _.get(LOG_LEVELS, options.loglevel) || LOG_LEVELS.info
    this.log = this.makeLog(backend.logger || basicLogger.call(this))

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
    this.CONST = CONST
    backend.server = this
    this.backend = backend
    this.actions = backend.actions
    this.options = options
    this.scheduler = backend.scheduler || this.defaultScheduler
    this.lib = backend.lib
    this._host = host || os.hostname()
    this._port = port || 8080
    this._server = `${this._host}:${this._port}`
    this._emitter = new Events.EventEmitter()
    this._sockets = {}
    this._socketTimeout = socket.timeout || 2000
    this._secureSocket = Boolean(socket.secure)
    this._running = {}
    this.queries = queries(this)
    this.addListeners = addListeners.bind(this)

    // token settings and creation
    this._tokenStore = tokenStore(this._host, this._port, token)
    this._token = this._tokenStore.token

    // get the global settings
    return this.queries.getSettings()
      .then((settings) => {
        this._appName = settings.appName || 'YELLOWJACKET'
        this._checkinFrequency = settings.checkinFrequency || 30
        this._queueCheckFrequency = settings.queueCheckFrequency || 30
        this._offlineAfterPolls = settings.offlineAfterPolls || 1
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
                if (!server.io && !server.app) {
                  this._app = http.createServer((req, res) => {
                    res.writeHead(200)
                    res.end(`${this._server}`)
                  })
                  this._app.listen(port)
                  this._io = new SocketServer(this._app)
                } else if (server.app && !server.io) {
                  this._app = server.app
                  this._io = new SocketServer(this._app)
                } else {
                  this._io = server.io
                }

                // if the state is online start the listeners
                if (this.state === ONLINE) this.startListeners(server.useConnection)
                return this
              })
          })

      })
      .catch((error) => {
        this.log.fatal({ server: this._server, error }, 'the server failed to start')
        throw this
      })
  }

  checkQueue () {
    setTimeout(() => {
      if (this.state === ONLINE) {
        this.log.trace({ server: this._server, app: this._appName }, 'system initiated run queue check')
        this._emitter.emit(RUN, {})
        this.checkQueue()
      }
    }, this._queueCheckFrequency * 1000)
  }

  isPromise (obj) {
    return _.isFunction(_.get(obj, 'then')) && _.isFunction(_.get(obj, 'catch'))
  }

  startListeners (useConnection) {
    startListeners.call(this, useConnection)
  }

  emit (host, port, event, payload, listener, cb, timeout) {
    return emitMethod.call(this, host, port, event, payload, listener, cb, timeout)
  }

  renewToken () {
    this._tokenStore.renew()
    this._token = this._tokenStore.token
    return this._token
  }

  schedule (payload, socket, requestId) {
    return scheduleMethod.call(this, payload, socket, requestId)
  }

  run (socket, requestId) {
    return runMethod.call(this, socket, requestId)
  }

  done (err, taskId, status, data) {
    return doneTask.call(this, taskId)(err, status, data)
  }

  resume (taskId, data) {
    return resumeTask.call(this, taskId, data)
  }

  stop (options, socket, requestId) {
    return stopMethod.call(this, options, socket, requestId)
  }

  maintenance (enter, reason, socket, requestId) {
    return maintenanceMethod.call(this, enter, reason, socket, requestId)
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

  makeLog (logger) {
    let updateArgs = (args) => {
      if (args.length && _.isObject(args[0])) args[0] = _.merge({ app: this._appName, server: this._server }, args[0])
      else args = [obj].concat(args)
      return args
    }

    return {
      fatal () {
        if (_.isFunction(_.get(logger, 'fatal'))) logger.fatal.apply(this, updateArgs([...arguments]))
      },
      error () {
        if (_.isFunction(_.get(logger, 'error'))) logger.error.apply(this, updateArgs([...arguments]))
      },
      warn () {
        if (_.isFunction(_.get(logger, 'warn'))) logger.warn.apply(this, updateArgs([...arguments]))
      },
      info () {
        if (_.isFunction(_.get(logger, 'info'))) logger.info.apply(this, updateArgs([...arguments]))
      },
      debug () {
        if (_.isFunction(_.get(logger, 'debug'))) logger.debug.apply(this, updateArgs([...arguments]))
      },
      trace () {
        if (_.isFunction(_.get(logger, 'trace'))) logger.trace.apply(this, updateArgs([...arguments]))
      }
    }
  }
}

export default function (backend, options) {
  return new YellowJacketServer(backend, options)
}