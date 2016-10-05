import _ from 'lodash'
import factory from 'graphql-factory'
import YellowJacketServer from '../server/index'
import YellowjacketClient from '../client/index'
import { LOG_LEVELS, EVENTS } from '../common/const'
let {
  OK, STOP, SCHEDULE, SCHEDULE_ACCEPT, SCHEDULE_ERROR, MAINTENANCE_ENTER, MAINTENANCE_EXIT, MAINTENANCE_ERROR,
  MAINTENANCE_OK, STOPPING, STOPPING_ACK
} = EVENTS

export function listRunner (args) {
  return this.queries.readRunner(args)
}

export function addRunner (args) {
  if (!_.isObject(args)) throw new Error('No options provided')
  let { host, port, zone, metadata } = args
  let payload = _.omitBy({ host, port, zone, metadata }, (v) => v === undefined)
  return this.queries.createRunner(payload)
}

export function removeRunner (args) {
  if (!_.get(args, 'id')) throw new Error('ID required to remove')
  let { id } = args
  return this.queries.deleteRunner(id)
}

export function updateRunner (args) {
  if (!_.isObject(args)) throw new Error('No options provided')
  if (args.state) args.state = factory.utils.Enum(args.state)
  return this.queries.updateRunner(args)
}

export function startRunner (options) {
  return YellowJacketServer(this, options)
    .then((server) => {
      this.server = server
      return server
    })
}

export function scheduleRunner ({ host, port, action, context, loglevel = LOG_LEVELS.info }) {
  let client = YellowjacketClient(this, { loglevel })

  return new Promise ((resolve, reject) => {
    client.emit(
      host,
      port,
      SCHEDULE,
      { action, context },
      {
        [SCHEDULE_ACCEPT]: () => {
          resolve('Schedule request accepted')
        },
        [SCHEDULE_ERROR]: (error) => {
          reject(error)
        }
      },
      (error) => {
        reject(error)
      }
    )
  })
}

export function stopRunner ({ host, port, loglevel = LOG_LEVELS.info }) {
  let client = YellowjacketClient(this, { loglevel })

  return new Promise ((resolve, reject) => {
    client.emit(
      host,
      port,
      STOP,
      {},
      {
        [STOPPING]: (socket) => {
          socket.emit(STOPPING_ACK)
          resolve('Server stopped')
        }
      },
      (error) => {
        reject(error)
      }
    )
  })
}

export function maintenanceRunner ({ host, port, exit, reason, loglevel = LOG_LEVELS.info }) {
  let client = YellowjacketClient(this, { loglevel })

  let EVT = exit ? MAINTENANCE_EXIT : MAINTENANCE_ENTER

  return new Promise ((resolve, reject) => {
    client.emit(
      host,
      port,
      EVT,
      reason,
      {
        [MAINTENANCE_OK]: () => {
          resolve(`${exit ? 'exit' : 'enter' }ed maintenance successfully`)
        },
        [MAINTENANCE_ERROR]: (error) => {
          reject(error)
        }
      },
      (error) => {
        reject(error)
      }
    )
  })
}


export default {
  listRunner,
  addRunner,
  removeRunner,
  updateRunner,
  startRunner,
  scheduleRunner,
  stopRunner,
  maintenanceRunner
}