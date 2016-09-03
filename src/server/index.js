import http from 'http'
import events from 'events'
import SocketServer from 'socket.io'
import bunyan from 'bunyan'
import startListeners from './startListeners'

import {
  OFFLINE,
  ONLINE,
  getLogConfig
} from './common'

function handler (req, res) {
  res.writeHead(200)
  res.end(ONLINE)
}

// server object constructor
function Server (lib, helper, actions, scheduler) {
  let { error, pretty, options } = helper
  let { cmd, host, port, role, id, loglevel, logfile } = options

  // check that the actions and scheduler are functions
  if (!_.isFunction(actions) || !_.isFunction(scheduler)) throw new Error('Invalid actions or scheduler')

  // set up logging
  let logConfig = getLogConfig(loglevel, logfile)
  this._logger = logConfig.level !== 100 ? bunyan.createLogger(logConfig) : false

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

  // set up socket.io server
  this._app = http.createServer(handler)
  this._app.listen(port)
  this._io = new SocketServer(this._app)

  // set up event emitter for local communication
  this._event = new events.EventEmitter()

  this.logInfo(`* Starting [YELLOWJACKET] server on ${host}:${port}`)
  this.startListeners()
}

Server.prototype.startListeners = startListeners

// logging prototypes
Server.prototype.logFatal = function () {
  if (this._logger) this._logger.fatal.apply(this._logger, arguments)
}
Server.prototype.logError = function () {
  if (this._logger) this._logger.error.apply(this._logger, arguments)
}
Server.prototype.logWarn = function () {
  if (this._logger) this._logger.warn.apply(this._logger, arguments)
}
Server.prototype.logInfo = function () {
  if (this._logger) this._logger.info.apply(this._logger, arguments)
}
Server.prototype.logDebug = function () {
  if (this._logger) this._logger.debug.apply(this._logger, arguments)
}
Server.prototype.logTrace = function () {
  if (this._logger) this._logger.trace.apply(this._logger, arguments)
}

export default Server