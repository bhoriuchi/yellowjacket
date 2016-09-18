import { LOG_LEVELS } from '../common/const'

// basic logging to the console
export default function () {
  let self = this
  return {
    fatal () {
      if (self._logLevel >= 0 && self._logLevel >= LOG_LEVELS.fatal) console.error.apply(null, [...arguments])
    },
    error () {
      if (self._logLevel >= 0 && self._logLevel >= LOG_LEVELS.error) console.error.apply(null, [...arguments])
    },
    warn () {
      if (self._logLevel >= 0 && self._logLevel >= LOG_LEVELS.warn) console.warn.apply(null, [...arguments])
    },
    info () {
      if (self._logLevel >= 0 && self._logLevel >= LOG_LEVELS.info) console.info.apply(null, [...arguments])
    },
    debug () {
      if (self._logLevel >= 0 && self._logLevel >= LOG_LEVELS.debug) console.log.apply(null, [...arguments])
    },
    trace () {
      if (self._logLevel >= 0 && self._logLevel >= LOG_LEVELS.trace) console.log.apply(null, [...arguments])
    }
  }
}