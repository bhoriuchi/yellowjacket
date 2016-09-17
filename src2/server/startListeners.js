import _ from 'lodash'
import { EVENTS } from '../common/const'
let {
  CONNECTION, AUTHENTICATE, AUTHENTICATION_ERROR, AUTHENTICATED, TOKEN, STATUS, SCHEDULE, RUN, STOP
} = EVENTS

export default function startListeners () {
  let event = this._emitter
  this.log.info({ method: 'startListeners', server: this._server }, `socket server is now listening`)

  // handle socket events
  this._io.on(CONNECTION, (socket) => {
    let client = _.get(socket, 'conn.remoteAddress', 'unknown')
    this.log.debug({ server: this._server, client }, 'socket.io connection made')

    // request authentication
    this.log.trace({ client, server: this._server }, 'emitting authentication request')
    socket.emit(AUTHENTICATE)

    // on receiving a token, attempt to authenticate it
    socket.on(TOKEN, (token) => {
      this.log.trace({ client, token, server: this._server }, 'received token response')

      // verify the token
      let payload = this.verify(token)

      // if the token is not valid send an error event back
      if (payload.error) {
        this.log.debug({ client, error, server: this._server }, 'socket authentication failed')
        return socket.emit(AUTHENTICATION_ERROR, payload)
      }

      // add the host to the sockets
      let { host, port } = payload
      if (!_.has(this._sockets, `${host}:${port}`)) {
        _.set(this._sockets, `${host}:${port}`, { socket, listeners: {} })
      }

      // set up remaining listeners now that we are authenticated
      this.log.trace({ client, server: this._server }, 'token is valid, setting up listeners')
      socket.emit(AUTHENTICATED)
      socket.on(STATUS, () => socket.emit(STATUS, this.info()))
      socket.on(SCHEDULE, (payload) => event.emit(SCHEDULE, { payload, socket }))
      socket.on(RUN, event.emit(RUN, socket))
      socket.on(STOP, (options) => event.emit(STOP, options, socket))
    })
  })

  // handle local events
  event.on(SCHEDULE, ({ payload, socket }) => this.schedule(payload, socket))
  event.on(RUN, ({ socket }) => this.run(socket))
  event.on(STOP, ({ options, socket }) => this.stop(options, socket))
}