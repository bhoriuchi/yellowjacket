import _ from 'lodash'
import EventEmitter from 'events'
import Express from 'express'
import http from 'http'
import SocketIO from 'socket.io'
import levelup from 'levelup'
import os from 'os'
import bunyan from 'bunyan'
import path from 'path'

// defaults
const DEFAULT_PORT = process.env.ENV === 'production'
  ? 80
  : 8080

const DEFAULT_DB_PATH = 'yellowjacket'
const DEFAULT_HB_INTERVAL = 60 * 1000

class LevelupWrapper {
  constructor (path, options) {
    this.db = levelup(path, options)
  }

  put (key, value, callback) {
    this.db.put(key, JSON.stringify(value), callback)
  }

  get (key, callback) {
    this.db.get(key, (err, value) => {
      return err
        ? callback(err)
        : callback(null, JSON.parse(value))
    })
  }
}


// main worker class
export default class Worker extends  EventEmitter {
  constructor (options, db) {
    super()
    options = _.isObject(options)
      ? options
      : {}

    // get options
    let { YJ_PORT, YJ_HOST, YJ_DB_PATH, YJ_HB_INTERVAL_MS } = process.env

    let expressMiddleware = _.isFunction(options.expressMiddleware)
      ? options.expressMiddleware
      : _.noop
    let ioMiddleware = _.isFunction(options.ioMiddleware)
      ? options.ioMiddleware
      : _.noop
    let logConfig = _.isObject(options.log)
      ? options.log
      : {}
    let dbPath = _.get(options, 'dbPath', YJ_DB_PATH || DEFAULT_DB_PATH)
    logConfig.name = logConfig.name || 'yellowjacket'

    this._heartbeatIntervalMs = _.isNumber(options.heartbeatIntervalMs)
      ? options.heartbeatIntervalMs
      : YJ_HB_INTERVAL_MS || DEFAULT_HB_INTERVAL
    this._port = _.get(options, 'port', YJ_PORT || DEFAULT_PORT)
    this._host = _.get(options, 'host', YJ_HOST || os.hostname())
    this._id = `${this._host}:${this._port}`

    // set up logger
    this.log = bunyan.createLogger(logConfig)

    // init server
    this._app = Express()
    this._server = http.Server(this._app)
    this._io = SocketIO(this._server, { path: '/socket.io/' })

    // add middleware
    expressMiddleware(this._app)
    ioMiddleware(this._io)

    // set up backends
    this.workers = new LevelupWrapper(path.join('/', dbPath, 'workers'), { db })
    this.jobs = new LevelupWrapper(path.join('/', dbPath, 'jobs'), { db })
    this.meta = new LevelupWrapper(path.join('/', dbPath, 'meta'), { db })
  }

  heartbeat (callback) {
    this.workers.put(this._id, {
      timestamp: Date.now()
    }, err => {
      if (err) {
        this.log.error('unable to set heartbeat')
        return callback(err)
      }
      return callback()
    })
  }

  run () {
    this.server = this._server.listen(this._port, error => {
      if (error) throw error
      this.heartbeat(error => {
        this.log.info(`Listening at http://${this._host}:${this._port}`)
        this._heartbeatInterval = setInterval(() => {
          this.heartbeat(err => {
            if (err) this.log.error('unable to set heartbeat')
          })
        }, this._heartbeatIntervalMs)
      })
    })
  }
}