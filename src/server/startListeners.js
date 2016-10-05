import _ from 'lodash'
import chalk from 'chalk'
import { EVENTS } from '../common/const'
let {
  CONNECTION, AUTHENTICATE, AUTHENTICATION_ERROR, AUTHENTICATED, TOKEN, STATUS, SCHEDULE, RUN, STOP,
  MAINTENANCE_ENTER, MAINTENANCE_EXIT, TOKEN_EXPIRED_ERROR
} = EVENTS

export function maskToken (token) {
  if (_.isString(token)) return token.replace(/(^\w{0,3}).*/, '$1***********************')
  return '***********************'
}

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
        socket.on(evtName, (payload) => {
          evt.handler.call(this, { payload, socket })
        })
      }
    })

    // request authentication
    this.log.trace({ client, server: this._server }, 'emitting authentication request')
    socket.emit(AUTHENTICATE)

    // on receiving a token, attempt to authenticate it
    socket.on(TOKEN, (token) => {
      this.log.trace({ client, token: maskToken(token), server: this._server }, 'received token response')

      // verify the token
      let payload = this.verify(token)

      // if the token is not valid send an error event back
      if (payload.error) {
        this.log.debug({ client, error: payload, server: this._server }, 'socket authentication failed')
        return payload.expired ? socket.emit(TOKEN_EXPIRED_ERROR, payload) : socket.emit(AUTHENTICATION_ERROR, payload)
      }

      // add the host to the sockets
      let { host, port } = payload
      if (!_.has(this._sockets, `${host}:${port}`)) {
        _.set(this._sockets, `${host}:${port}`, socket)
      }

      // set up remaining listeners now that we are authenticated
      this.log.trace({ client, server: this._server }, 'token is valid, setting up listeners')

      // register post-authentication events
      _.forEach(_.get(this, 'backend.events.socket'), (evt, evtName) => {
        if (_.get(evt, 'noAuth') !== true && _.isFunction(evt.handler)) {
          this.log.trace({ eventRegistered: evtName }, 'registering post-auth socket event')
          socket.on(evtName, (payload) => {
            evt.handler.call(this, { payload, socket })
          })
        }
      })

      socket.on(STATUS, ({ requestId }) => {
        this.log.trace({ client, server: this._server, event: STATUS }, 'received socket event')
        socket.emit(`${STATUS}.${requestId}`, this.info())
      })

      socket.on(SCHEDULE, ({ payload, requestId }) => {
        this.log.trace({ client, server: this._server, event: SCHEDULE }, 'received socket event')
        event.emit(SCHEDULE, { requestId, payload, socket })
      })

      socket.on(RUN, ({ requestId }) => {
        this.log.trace({ client, server: this._server, event: RUN }, 'received socket event')
        event.emit(RUN, { requestId, socket })
      })

      socket.on(STOP, ({ requestId, options }) => {
        options = options || {}
        this.log.trace({ client, server: this._server, event: STOP }, 'received socket event')
        event.emit(STOP, { requestId, options, socket })
      })

      socket.on(MAINTENANCE_ENTER, ({ requestId, reason }) => {
        this.log.trace({ client, server: this._server, event: MAINTENANCE_ENTER }, 'received socket event')
        event.emit(MAINTENANCE_ENTER, { requestId, reason, socket })
      })

      socket.on(MAINTENANCE_EXIT, ({ requestId, reason }) => {
        this.log.trace({ client, server: this._server, event: MAINTENANCE_EXIT }, 'received socket event')
        event.emit(MAINTENANCE_EXIT, { requestId, reason, socket })
      })

      socket.emit(AUTHENTICATED)
    })
  })

  // register local events
  _.forEach(_.get(this, 'backend.events.local'), (evt, evtName) => {
    if (_.isFunction(evt.handler)) {
      this.log.trace({ eventRegistered: evtName }, 'registering local event')
      event.on(evtName, (payload) => {
        console.log(chalk.green('made it to local event', evtName))
        evt.handler.call(this, payload)
      })
    }
  })

  // handle local events
  event.on(SCHEDULE, ({ requestId, payload, socket }) => {
    this.log.trace({ server: this._server, event: SCHEDULE }, 'received local event')
    this.schedule(payload, socket, requestId)
  })

  event.on(RUN, ({ requestId, socket }) => {
    this.log.trace({ server: this._server, event: RUN }, 'received local event')
    this.run(socket, requestId)
  })

  event.on(STOP, ({ requestId, options, socket }) => {
    this.log.trace({ server: this._server, event: STOP }, 'received local event')
    this.stop(options, socket, requestId)
  })

  event.on(MAINTENANCE_ENTER, ({ requestId, reason, socket }) => {
    this.log.trace({ server: this._server, event: MAINTENANCE_ENTER }, 'received local event')
    this.maintenance(true, reason, socket, requestId)
  })

  event.on(MAINTENANCE_EXIT, ({ requestId, reason, socket }) => {
    this.log.trace({ server: this._server, event: MAINTENANCE_EXIT }, 'received local event')
    this.maintenance(false, reason, socket, requestId)
  })

  this.checkQueue()
}