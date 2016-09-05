import _ from 'lodash'
import chalk from 'chalk'
import * as graphql from 'graphql'
import rethinkdbdash from 'rethinkdbdash'
import { rethinkdb as RethinkDBBackend } from '../../src/backend'
import YJApp from '../../src/app'
import YJInstaller from '../../src/app/install'
let backend = new RethinkDBBackend(rethinkdbdash({ silent: true }), graphql)


let actions = {
  print (runner, context, done) {
    console.log(chalk.green(JSON.stringify(context, null, '  ')))
    done()
  }
}

let scheduler = function (runner, nodeList, queue, cb) {
  // let nodes = _.filter(nodeList, { id: runner.id })
  return cb(null, [ runner.info() ])
}

export function yjcli () {
  YJApp(backend, undefined, actions, scheduler)
}

export function yjinstall () {
  YJInstaller(backend)
}

export default {
  yjcli,
  yjinstall
}