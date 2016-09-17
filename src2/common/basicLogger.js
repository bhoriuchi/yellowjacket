import { LOG_LEVELS } from '../common'

// basic logging to the console
export default {
  fatal () {
    if (this._logLevel >= 0 && this._logLevel >= LOG_LEVELS.fatal) console.error.apply(null, [...arguments])
  },
  error () {
    if (this._logLevel >= 0 && this._logLevel >= LOG_LEVELS.error) console.error.apply(null, [...arguments])
  },
  warn () {
    if (this._logLevel >= 0 && this._logLevel >= LOG_LEVELS.warn) console.warn.apply(null, [...arguments])
  },
  info () {
    if (this._logLevel >= 0 && this._logLevel >= LOG_LEVELS.info) console.info.apply(null, [...arguments])
  },
  debug () {
    if (this._logLevel >= 0 && this._logLevel >= LOG_LEVELS.debug) console.log.apply(null, [...arguments])
  },
  trace () {
    if (this._logLevel >= 0 && this._logLevel >= LOG_LEVELS.trace) console.log.apply(null, [...arguments])
  }
}