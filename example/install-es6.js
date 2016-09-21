import { rethinkdb as RethinkDBBackend } from '../src/backend/index'
import rethinkdbdash from 'rethinkdbdash'
import * as graphql from 'graphql'

// create backend
let backend = RethinkDBBackend('_yj', graphql, rethinkdbdash())

// init all stores
backend.initAllStores(true).then((res) => {
  console.log(res)
  process.exit()
})