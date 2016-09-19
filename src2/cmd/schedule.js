import YellowjacketClient from '../client/index'
import { LOG_LEVELS, EVENTS } from '../common/const'
let { DISCONNECT, OK, SCHEDULE, SCHEDULE_ACCEPT, SCHEDULE_ERROR } = EVENTS

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

export default {
  scheduleRunner
}