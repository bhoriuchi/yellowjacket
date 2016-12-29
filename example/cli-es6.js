import { YellowjacketRethinkDBBackend } from '../src/backend/index'
import rethinkdbdash from 'rethinkdbdash'
import * as graphql from 'graphql'

let backend = (new YellowjacketRethinkDBBackend('_yj', graphql, rethinkdbdash(), {
  actions: {
    print (backend, context, done) {
      console.log('hello')
      done()
    }
  }
})).make()

backend.cli()