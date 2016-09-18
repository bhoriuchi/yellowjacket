import { rethinkdb as RethinkDBBackend } from '../backend/index'
import rethinkdbdash from 'rethinkdbdash'
import * as graphql from 'graphql'

let [ host, port, loglevel ] = [ 'localhost', 8091, 'trace' ]

let seedData = {
  RunnerSettings: [
    {
      appName: 'YELLOWJACKET',
      checkinFrequency: 30,
      offlineAfterPolls: 1
    }
  ],
  RunnerZone: [
    {
      id: '32f2eb22-e793-44f9-a942-826dc5ed2c52',
      name: 'US Test',
      description: 'Testing zone',
      metadata: {
        facts: ['US', 'TEST']
      }
    }
  ]
}

// create backend
let backend = RethinkDBBackend('_yj', graphql, rethinkdbdash(), {
  actions: {
    print () {
      console.log('hello')
    }
  }
})

// init all stores
backend.initAllStores(true, seedData).then((res) => {
  return backend.cmd({
    target: 'runner',
    action: 'add',
    options: { host, port }
  })
    .then((result) => {
      if (result.errors) throw result.errors
      return backend.cmd({
        target: 'runner',
        action: 'start',
        options: { host, port, loglevel }
      })
    })
})
.catch((error) => {
  console.log(error)
  process.exit()
})