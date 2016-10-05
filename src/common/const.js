export const ONE_SECOND_IN_MS = 1000

// log levels
export const LOG_LEVELS = {
  fatal: 60,
  error: 50,
  warn: 40,
  info: 30,
  debug: 20,
  trace: 10,
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
  STOPPING: 'stopping',
  STOPPING_ACK: 'stopping.acknowledge',
  STOP_ERROR: 'stop.error',
  RESTART: 'restart',
  RESTART_ERROR: 'restart.error',
  AUTHENTICATE: 'authenticate',
  TOKEN: 'token',
  TOKEN_EXPIRED_ERROR: 'token.expired.error',
  AUTHENTICATION_ERROR: 'authentication.error',
  AUTHENTICATED: 'authenticated',
  MAINTENANCE_ENTER: 'maintenance.enter',
  MAINTENANCE_EXIT: 'maintenance.exit',
  MAINTENANCE_ERROR: 'maintenance.error',
  MAINTENANCE_OK: 'maintenance.ok',
  RESULT: 'result'
}

// defaults for JWT
export const SIGNING_KEY = 'twothingsareinfinitetheuniverseandhumanstupidityandimnotsureabouttheuniverse'
export const SIGNING_ALG = 'none'
export const TOKEN_EXPIRES_IN = 30

export default {
  ONE_SECOND_IN_MS,
  LOG_LEVELS,
  EVENTS,
  SIGNING_KEY,
  SIGNING_ALG
}