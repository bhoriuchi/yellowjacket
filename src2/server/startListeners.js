import _ from 'lodash'
import { EVENTS } from '../common/const'
let { CONNECTION, CONNECTED, STATUS, SCHEDULE, RUN, STOP } = EVENTS

export default function startListeners () {
  let event = this._emitter
  this.log.info({ method: 'startListeners', server: this._server }, `socket server is now listening`)

  // handle socket events
  this._io.on(CONNECTION, (socket) => {
    let client = _.get(socket, 'conn.remoteAddress', 'unknown')
    this.log.debug({ server: this._server, client }, 'socket.io connection made')

    socket.emit(CONNECTED)
    socket.on(STATUS, () => socket.emit(STATUS, this.info()))
    socket.on(SCHEDULE, (payload) => event.emit(SCHEDULE, { payload, socket }))
    socket.on(RUN, event.emit(RUN, socket))
    socket.on(STOP, (options) => event.emit(STOP, options, socket))
  })

  // handle local events
  event.on(SCHEDULE, ({ payload, socket }) => this.schedule(payload, socket))
  event.on(RUN, (socket) => this.run(socket))
  event.on(STOP, (options, socket) => this.stop(options, socket))
}