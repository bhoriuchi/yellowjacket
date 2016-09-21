import { EVENTS } from '../common/const'
import { RunnerNodeStateEnum } from '../graphql/types/index'
let { values: { ONLINE, MAINTENANCE } } = RunnerNodeStateEnum
let { MAINTENANCE_OK, MAINTENANCE_ERROR } = EVENTS


export default function maintenance (enter, reason, socket) {
  if (enter && this.state === ONLINE) {
    this.log.info({ server: this._server, reason }, 'entering maintenance')
    this.state = MAINTENANCE

    return this.queries.checkIn()
      .then(() => {
        if (socket) socket.emit(MAINTENANCE_OK)
        return true
      })
  } else if (!enter && this.state === MAINTENANCE) {
    this.log.info({ server: this._server, reason }, 'exiting maintenance')
    this.state = ONLINE

    return this.queries.checkIn()
      .then(() => {
        if (socket) socket.emit(MAINTENANCE_OK)
        return true
      })
  } else {
    let msg = `cannot ${enter ? 'enter' : 'exit'} maintenance while state is ${this.state}`
    if (socket) socket.emit(MAINTENANCE_ERROR, msg)
    return Promise.reject(msg)
  }
}