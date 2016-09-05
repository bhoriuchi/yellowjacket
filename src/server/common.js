import _ from 'lodash'
import StateEnum from '../graphql/types/RunnerNodeStateEnum'

// export enums
export const OFFLINE = StateEnum.values.OFFLINE
export const ONLINE = StateEnum.values.ONLINE
export const MAINTENANCE = StateEnum.values.MAINTENANCE

export const ONE_SECOND_IN_MS = 1000

export const LOG_LEVELS = {
  fatal: 60,
  error: 50,
  warn: 40,
  info: 30,
  debug: 20,
  trace: 10,
  silent: 100
}


export function circular (obj, value = '[Circular]') {
  let circularEx = (_obj, key = null, seen = []) => {
    seen.push(_obj)
    if (_.isObject(_obj)) {
      _.forEach(_obj, (o, i) => {
        if (_.includes(seen, o)) _obj[i] = _.isFunction(value) ? value(_obj, key, _.clone(seen)) : value
        else circularEx(o, i, _.clone(seen))
      })
    }
    return _obj
  }

  if (!obj) throw new Error('circular requires an object to examine')
  return circularEx(obj, value)
}

export function toLiteralJSON (obj) {
  let toLiteralEx = (o) => {
    if (_.isArray(o)) {
      return `[${_.map(o, (v) => toLiteralEx(v)).join(',')}]`
    } else if (_.isString(o)) {
      return `"${o}"`
    } else if (_.isDate(o)) {
      return `"${o.toISOString()}"`
    } else if (_.isObject(o)) {
      return `{${_.map(o, (v, k) => `${k}:${toLiteralEx(v)}`).join(',')}}`
    } else {
      return o
    }
  }
  return toLiteralEx(circular(obj))
}

export function logLevel (level = 'info') {
  level = _.toLower(level)
  return _.get(LOG_LEVELS, level, LOG_LEVELS.info)
}

export function getLogConfig (appName, level = 'info', file) {
  level = logLevel(level)
  let logStreams = [ { stream: process.stdout, level } ]
  if (file) logStreams.push({ path: logfile, level })
  return { name: appName, streams: logStreams }
}

export default {
  logLevel,
  getLogConfig,
  circular,
  toLiteralJSON
}