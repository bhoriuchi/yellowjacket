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

socket.on('schedule.error', (err) => {
  console.log('Schedule Error')
  console.log(err)
  process.exit()
})

socket.on('connect_error', () => {
  process.exit()
})
socket.on('connect_timeout', () => {
  process.exit()
})