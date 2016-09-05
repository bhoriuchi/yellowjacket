import chalk from 'chalk'
import { EVENTS } from './const'
let { CONNECTION, CONNECTED, STATUS, SCHEDULE, RUN, OK } = EVENTS

export default function startListeners () {
  this.logInfo(`Socket server is now listening on ${this._server}`)

  this._io.on(CONNECTION, (socket) => {
    socket.emit(CONNECTED)
    socket.on(STATUS, () => socket.emit(STATUS, this.info()))
    socket.on(SCHEDULE, (payload) => this.schedule(socket, payload))
    socket.on(RUN, () => {
      socket.emit(OK)
      console.log(chalk.bold.blue('check run queue'))
    })
  })
}