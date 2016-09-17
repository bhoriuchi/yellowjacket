import _ from 'lodash'
import Events from 'events'
import http from 'http'
import SocketServer from 'socket.io'
import queries from '../graphql/queries/index'
import { LOG_LEVELS } from '../common/const'
import basicLogger from '../common/basicLogger'
import startListeners from './startListeners'
import { RunnerNodeStateEnum } from '../graphql/types/index'
let { values: { ONLINE, MAINTENANCE } } = RunnerNodeStateEnum

export class YellowJacketServer {
  constructor (backend, actions, scheduler, logger = basicLogger, options = {}) {
    let { host, port } = options
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
    this._running = {}

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