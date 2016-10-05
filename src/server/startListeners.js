import _ from 'lodash'
import { EVENTS } from '../common/const'
let {
  CONNECTION, AUTHENTICATE, AUTHENTICATION_ERROR, AUTHENTICATED, TOKEN, STATUS, SCHEDULE, RUN, STOP,
  MAINTENANCE_ENTER, MAINTENANCE_EXIT
} = EVENTS

export default function startListeners () {
  let event = this._emitter
  this.log.info({ method: 'startListeners', server: this._server }, `socket server is now listening`)

  // handle socket events
  this._io.on(CONNECTION, (socket) => {
    let client = _.get(socket, 'conn.remoteAddress', 'unknown')
    this.log.debug({ server: this._server, client }, 'socket.io connection made')

    // register pre-authentication events
    _.forEach(_.get(this, 'backend.events.socket'), (evt, evtName) => {
      if (_.get(evt, 'noAuth') === true && _.isFunction(evt.handler)) {
        this.log.trace({ eventRegistered: evtName }, 'registering pre-auth socket event')
        socket.on(evtName, (payload) => evt.handler.call(this, payload))
      }
    })

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
        this.log.debug({ client, error: payload, server: this._server }, 'socket authentication failed')
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


      // register post-authentication events
      _.forEach(_.get(this, 'backend.events.socket'), (evt, evtName) => {
        if (_.get(evt, 'noAuth') !== true && _.isFunction(evt.handler)) {
          this.log.trace({ eventRegistered: evtName }, 'registering post-auth socket event')
          socket.on(evtName, (payload) => evt.handler.call(this, payload))
        }
      })

      socket.on(STATUS, () => {
        this.log.trace({ client, server: this._server, event: STATUS }, 'received socket event')
        socket.emit(STATUS, this.info())
      })

      socket.on(SCHEDULE, (payload) => {
        this.log.trace({ client, server: this._server, event: SCHEDULE }, 'received socket event')
        event.emit(SCHEDULE, { payload, socket })
      })

      socket.on(RUN, () => {
        this.log.trace({ client, server: this._server, event: RUN }, 'received socket event')
        event.emit(RUN, socket)
      })

      socket.on(STOP, (options = {}) => {
        this.log.trace({ client, server: this._server, event: STOP }, 'received socket event')
        event.emit(STOP, { options, socket })
      })

      socket.on(MAINTENANCE_ENTER, (reason) => {
        this.log.trace({ client, server: this._server, event: MAINTENANCE_ENTER }, 'received socket event')
        event.emit(MAINTENANCE_ENTER, { reason, socket })
      })

      socket.on(MAINTENANCE_EXIT, (reason) => {
        this.log.trace({ client, server: this._server, event: MAINTENANCE_EXIT }, 'received socket event')
        event.emit(MAINTENANCE_EXIT, { reason, socket })
      })
    })
  })

  // register local events
  _.forEach(_.get(this, 'backend.events.local'), (evt, evtName) => {
    if (_.isFunction(evt.handler)) {
      this.log.trace({ eventRegistered: evtName }, 'registering local event')
      event.on(evtName, (payload) => evt.handler.call(this, payload))
    }
  })

  // handle local events
  event.on(SCHEDULE, ({ payload, socket }) => {
    this.log.trace({ server: this._server, event: SCHEDULE }, 'received local event')
    this.schedule(payload, socket)
  })

  event.on(RUN, (socket) => {
    this.log.trace({ server: this._server, event: RUN }, 'received local event')
    this.run(socket)
  })

  event.on(STOP, ({ options, socket }) => {
    this.log.trace({ server: this._server, event: STOP }, 'received local event')
    this.stop(options, socket)
  })

  event.on(MAINTENANCE_ENTER, ({ reason, socket }) => {
    this.log.trace({ server: this._server, event: MAINTENANCE_ENTER }, 'received local event')
    this.maintenance(true, reason, socket)
  })

  event.on(MAINTENANCE_EXIT, ({ reason, socket }) => {
    this.log.trace({ server: this._server, event: MAINTENANCE_EXIT }, 'received local event')
    this.maintenance(false, reason, socket)
  })

  this.checkQueue()
}