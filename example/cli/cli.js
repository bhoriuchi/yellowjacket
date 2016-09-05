import _ from 'lodash'
import * as graphql from 'graphql'
import rethinkdbdash from 'rethinkdbdash'
import { rethinkdb as RethinkDBBackend } from '../../src/backend'
import YJApp from '../../src/app'
import YJInstaller from '../../src/app/install'
let backend = new RethinkDBBackend(rethinkdbdash({ silent: true }), graphql)


let actions = function (yj) {
  return {
    print: {
      run () {
        console.log('Im running print')
      },
      success () {
        console.log('I ran print SUCCESSFULLY')
      },
      fail () {
        console.error('I FAILED print')
      }
    }
  }
}

let scheduler = function (runner, nodeList, queue, cb) {
  let nodes = _.filter(nodeList, { id: runner.id })
  return cb(null, nodes)
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