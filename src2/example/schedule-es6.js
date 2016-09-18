import { rethinkdb as RethinkDBBackend } from '../backend/index'
import rethinkdbdash from 'rethinkdbdash'
import * as graphql from 'graphql'

// create backend
let backend = RethinkDBBackend('_yj', graphql, rethinkdbdash(), {})

backend.cmd({
  target: 'runner',
  action: 'schedule',
  options: { action: 'print', context: {} }
})
.then((result) => {
  console.log(result)
  process.exit()
})
.catch((error) => {
  console.log(error)
  process.exit()
})