import _ from 'lodash'
import { EVENTS } from './const'
let { CONNECTION, CONNECTED, STATUS, SCHEDULE, RUN, STOP } = EVENTS

export default function startListeners () {
  this.logInfo(`Socket server is now listening on ${this._server}`, { method: 'startListeners' })

  this._io.on(CONNECTION, (socket) => {
    this.logDebug('Connection made', { client: _.get(socket, 'conn.remoteAddress', 'unknown')})
    socket.emit(CONNECTED)
    socket.on(STATUS, () => socket.emit(STATUS, this.info()))
    socket.on(SCHEDULE, (payload) => this.schedule(socket, payload))
    socket.on(RUN, this.run(socket))
    socket.on(STOP, (options = {}) => this.stop(socket, options))
  })
}