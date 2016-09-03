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
  getLogConfig
}