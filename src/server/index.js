import _ from 'lodash'
import http from 'http'
import events from 'events'
import SocketServer from 'socket.io'
import bunyan from 'bunyan'
import startListeners from './startListeners'
import getSelf from './getSelf'
import getSettings from './getSettings'
import checkin from './checkin'
import schedule from './schedule'
import { LOG_LEVELS } from './common'
import { OFFLINE, MAINTENANCE, ONLINE, getLogConfig } from './common'

// server object constructor
function Server (lib, helper, actions, scheduler) {
  let { error, pretty, options } = helper
  let { host, port, loglevel, logfile } = options.options

  // check that the actions and scheduler are functions
  if (!_.isFunction(actions) || !_.isFunction(scheduler)) throw new Error('Invalid actions or scheduler')

  // reference helper functions
  this._pretty = pretty
  this._error = error

  // store the server config
  this._actions = actions(this)
  this._scheduler = scheduler(this)
  this._lib = lib
  this._state = OFFLINE
  this._host = host
  this._port = Number(port)
  this._server = `${this._host}:${this._port}`
  this._event = new events.EventEmitter()

  // get the global settings
  this.getSettings()
    .then((settings) => {
      this._appName = settings.appName
      this._checkinFrequency = settings.checkinFrequency
      this._offlineAfterPolls = settings.offlineAfterPolls
      this._offlineAfter = this._checkinFrequency * this._offlineAfterPolls

      // set up logging
      let logConfig = getLogConfig(this._appName, loglevel, logfile)
      this._logger = logConfig.level !== LOG_LEVELS.silent ? bunyan.createLogger(logConfig) : false

      // log startup
      this.logInfo(`Starting [${this._appName}] server on ${this._server}`)

      // get the current nodes config
      return this.getSelf()
        .then((self) => {
          this._id = self.id
          this._state = self.state === MAINTENANCE ? MAINTENANCE : ONLINE
          return this.checkin().then(() => {

            // set up socket.io server
            this._app = http.createServer((req, res) => {
              res.writeHead(200)
              res.end(`${this._server}`)
            })
            this._app.listen(port)
            this._io = new SocketServer(this._app)

            // if the state is online start the listeners
            if (self.state === ONLINE) this.startListeners()
          })
        })
    })
    .catch((err) => {
      this._logger ? this.logFatal(err) : console.error(err)
      process.exit()
    })
}

// server methods
Server.prototype.checkin = checkin
Server.prototype.getSelf = getSelf
Server.prototype.getSettings = getSettings
Server.prototype.schedule = schedule
Server.prototype.startListeners = startListeners

// logging prototypes
Server.prototype.logFatal = function (msg, obj = {}) {
  _.merge(obj, { server: this._server })
  if (this._logger) this._logger.fatal(obj, msg)
}
Server.prototype.logError = function (msg, obj = {}) {
  _.merge(obj, { server: this._server })
  if (this._logger) this._logger.error(obj, msg)
}
Server.prototype.logWarn = function (msg, obj = {}) {
  _.merge(obj, { server: this._server })
  if (this._logger) this._logger.warn(obj, msg)
}
Server.prototype.logInfo = function (msg, obj = {}) {
  _.merge(obj, { server: this._server })
  if (this._logger) this._logger.info(obj, msg)
}
Server.prototype.logDebug = function (msg, obj = {}) {
  _.merge(obj, { server: this._server })
  if (this._logger) this._logger.debug(obj, msg)
}
Server.prototype.logTrace = function (msg, obj = {}) {
  _.merge(obj, { server: this._server })
  if (this._logger) this._logger.trace(obj, msg)
}

export default Server