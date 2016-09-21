import { rethinkdb as RethinkDBBackend } from '../index'
import rethinkdbdash from 'rethinkdbdash'
import * as graphql from 'graphql'

let backend = RethinkDBBackend('_yj', graphql, rethinkdbdash(), {
  actions: {
    print (backend, context, done) {
      console.log('hello')
      done()
    }
  }
})

backend.cli()