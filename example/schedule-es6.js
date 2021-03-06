import { rethinkdb as RethinkDBBackend } from '../src/backend/index'
import rethinkdbdash from 'rethinkdbdash'
import * as graphql from 'graphql'

// create backend
let backend = RethinkDBBackend('_yj', graphql, rethinkdbdash(), {})

backend.cmd({
  target: 'runner',
  action: 'schedule',
  options: {
    host: 'localhost',
    port: 8091,
    action: 'print',
    context: {},
    loglevel: 'trace'
  }
})
.then((result) => {
  console.log(result)
  process.exit()
})
.catch((error) => {
  console.log(error)
  process.exit()
})