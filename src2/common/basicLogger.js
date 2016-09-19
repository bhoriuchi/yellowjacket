import _ from 'lodash'
import { LOG_LEVELS } from '../common/const'

function logify (level, args) {
  if (_.isObject(_.get(args, '[0]'))) {
    args[0].level = level
  } else {
    args = [{ level }].concat(args)
  }
  return args
}


// basic logging to the console
export default function () {
  let self = this
  return {
    fatal () {
      if (self._logLevel >= 0 && self._logLevel <= LOG_LEVELS.fatal) {
        console.error.apply(null, logify(LOG_LEVELS.fatal, [...arguments]))
      }
    },
    error () {
      if (self._logLevel >= 0 && self._logLevel <= LOG_LEVELS.error) {
        console.error.apply(null, logify(LOG_LEVELS.error, [...arguments]))
      }
    },
    warn () {
      if (self._logLevel >= 0 && self._logLevel <= LOG_LEVELS.warn) {
        console.warn.apply(null, logify(LOG_LEVELS.warn, [...arguments]))
      }
    },
    info () {
      if (self._logLevel >= 0 && self._logLevel <= LOG_LEVELS.info) {
        console.info.apply(null, logify(LOG_LEVELS.info, [...arguments]))
      }
    },
    debug () {
      if (self._logLevel >= 0 && self._logLevel <= LOG_LEVELS.debug) {
        console.log.apply(this, logify(LOG_LEVELS.debug, [...arguments]))
      }
    },
    trace () {
      if (self._logLevel >= 0 && self._logLevel <= LOG_LEVELS.trace) {
        console.log.apply(null, logify(LOG_LEVELS.trace, [...arguments]))
      }
    }
  }
}