export default function startListeners () {
  this.logInfo(`Socket server is now listening on ${this._server}`)

  this._io.on('connection', (socket) => {
    socket.emit('connected')
    socket.on('status', () => socket.emit('status', this.info()))
    socket.on('schedule', (payload) => this.schedule(socket, payload))
    socket.on('run', () => console.log('check run queue'))
  })
}