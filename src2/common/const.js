export const ONE_SECOND_IN_MS = 1000

// log levels
export const LOG_LEVELS = {
  fatal: 60,
  error: 50,
  warn: 40,
  info: 30,
  debug: 20,
  silent: -1
}

export const EVENTS = {
  CONNECTION: 'connection',
  CONNECTED: 'connected',
  CONNECT_ERROR: 'connect_error',
  CONNECT_TIMEOUT: 'connect_timeout',
  DISCONNECT: 'disconnect',
  STATUS: 'status',
  SCHEDULE: 'schedule',
  SCHEDULE_ERROR: 'schedule.error',
  SCHEDULE_ACCEPT: 'schedule.accept',
  RUN: 'run',
  OK: 'ok',
  STOP: 'stop',
  STOP_ERROR: 'stop.error',
  RESTART: 'restart',
  RESTART_ERROR: 'restart.error'
}

export default {
  ONE_SECOND_IN_MS,
  LOG_LEVELS,
  EVENTS
}