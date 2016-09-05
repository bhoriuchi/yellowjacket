import SocketClient from 'socket.io-client'

let [ host, port ] = [ 'localhost', 8091 ]

let socket = SocketClient(`http://${host}:${port}`, { timeout: 2000 })
socket.on('connected', () => {
  socket.emit('schedule', {
    action: 'print',
    context: {
      message: 'hi im a context message'
    }
  })
})
socket.on('schedule.accept', () => {
  console.log('Accepted schedule request')
  socket.emit('disconnect')
  socket.disconnect(0)
  process.exit()
})

socket.on('schedule.error', (err) => {
  console.log('Schedule Error')
  console.log(err)
  socket.emit('disconnect')
  socket.disconnect(0)
  process.exit()
})

socket.on('connect_error', () => {
  console.log('connection error')
  socket.emit('disconnect')
  socket.disconnect(0)
  process.exit()
})
socket.on('connect_timeout', () => {
  console.log('timed out')
  socket.emit('disconnect')
  socket.disconnect(0)
  process.exit()
})