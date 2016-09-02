import http from 'http'
import events from 'events'
import SocketServer from 'socket.io'
import bunyan from 'bunyan'
import getNodeConfig from './getNodeConfig'
import heartbeat from './heartbeat'
import offlineNode from './offlineNode'
import startListeners from './startListeners'
import {
  OFFLINE,
  ONLINE,
  getLogConfig
} from './common'

function handler (req, res) {
  res.writeHead(200)
  res.end('ONLINE')
}

// server object constructor
function Server (lib, helper) {
  let { error, pretty, options } = helper
  let { cmd, host, port, role, id, loglevel, logfile } = options
  let logConfig = getLogConfig(loglevel, logfile)
  this._hb = {}
  this._peers = {}
  this._pretty = pretty
  this._error = error
  this._lib = lib
  this._roles = []
  this._state = OFFLINE
  this._host = host
  this._port = Number(port)
  this._app = http.createServer(handler)
  this._app.listen(port)
  this._event = new events.EventEmitter()
  this._io = new SocketServer(this._app)
  this._hbInterval = 5000
  this._hbTimeout = 2000
  this._logger = logConfig.level !== 100 ? bunyan.createLogger(logConfig) : false

  this.logInfo(`* Starting [YELLOWJACKET] server on ${host}:${port}`)

  return this.getNodeConfig((err, nodes, config) => {
    this._id = config.id
    this.startListeners()
    this.heartbeat()
  })
}

Server.prototype.getNodeConfig = getNodeConfig
Server.prototype.heartbeat = heartbeat
Server.prototype.offlineNode = offlineNode
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