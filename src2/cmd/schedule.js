import YellowjacketClient from '../client/index'
import { LOG_LEVELS, EVENTS } from '../common/const'
let { DISCONNECT, OK, SCHEDULE, SCHEDULE_ACCEPT, SCHEDULE_ERROR } = EVENTS

export function scheduleRunner ({ host, port, payload }) {
  let client = YellowjacketClient(this)

  return new Promise ((resolve, reject) => {
    client.emit(
      host,
      port,
      SCHEDULE,
      payload,
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