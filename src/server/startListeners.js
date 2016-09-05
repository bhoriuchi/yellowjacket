let { ONLINE } = './common'

export default function startListeners () {
  this.logInfo(`Socket server is now listening on ${this._host}:${this._port}`)

  let currentStatus = () => {
    return {
      id: this._id,
      host: this._host,
      port: this._port,
      state: this._state
    }
  }

  // socket listeners
  this._io.on('connection', (socket) => {
    socket.emit('connected')
    socket.on('status', () => socket.emit('status', currentStatus()))
    socket.on('schedule', (payload) => this.schedule(socket, payload))
    socket.on('run', () => console.log('check run queue'))
  })
}