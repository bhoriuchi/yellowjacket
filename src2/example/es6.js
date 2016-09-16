import { rethinkdb as RethinkDBBackend } from '../backend/index'
import rethinkdbdash from 'rethinkdbdash'
import * as graphql from 'graphql'
import chalk from 'chalk'

function pretty (obj) {
  return JSON.stringify(obj, null, '  ')
}
function prettyPrint(obj, color = 'white') {
  console.log(chalk[color](pretty(obj)))
}
function errorPrint(err) {
  console.error(chalk.red(err))
}

let backend = RethinkDBBackend('_yj', graphql, rethinkdbdash())
let lib = backend.lib

/*
lib.YJRunner(`mutation Mutation {
  createRunnerNode (
    host: "localhost",
    port: 8097,
    zone: "32f2eb22-e793-44f9-a942-826dc5ed2c52"
  ) {
    id,
    host,
    port,
    zone { id, name }
  }
}`)
  */
lib.YJRunner(`mutation Mutation {
  checkinRunnerNode (
    id: "d848089d-d48a-4db3-8733-6c8a30969e6b",
    state: ONLINE,
    offlineAfter: 30000
  )
}`)
  .then((result) => {
    if (result.errors) console.log(result)
    else prettyPrint(result, 'green')
    process.exit()
  })
  .catch((err) => {
    errorPrint(err)
    process.exit()
  })
