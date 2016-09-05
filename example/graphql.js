import _ from 'lodash'
import chalk from 'chalk'
import * as graphql from 'graphql'
import rethinkdbdash from 'rethinkdbdash'
import { rethinkdb as RethinkDBBackend } from '../src/backend'
import gql from '../src/graphql'
import QueueState from '../src/graphql/types/RunnerQueueStateEnum'
import RunnerState from '../src/graphql/types/RunnerNodeStateEnum'
import { toLiteralJSON } from '../src/server/common'
let { UNSCHEDULED } = QueueState.values
let { ONLINE } = RunnerState.values

console.log(toLiteralJSON({
  test: 'message',
  date: new Date(),
  arr: [
    1,
    [ 'x', 'y', 'z'],
    { two: 1 }
  ]
}))

process.exit()
let backend = new RethinkDBBackend(rethinkdbdash({ silent: true }), graphql)
let lib = gql(backend)

// lib.Runner(`{ readRunner (state: ${ONLINE}) { id, host, port, zone { id, name, description, metadata }, state, metadata } }`)

lib.Runner(`
  mutation Mutation {
    createQueue (
      action: "TEST",
      state: ${UNSCHEDULED},
      context: { hi: "there", ar: [1, { stuff: 1}] }
    )
    {
      id, action, context
    }
  }
`)

.then((res) => {
  if (res.errors) console.error(chalk.red(res.errors))
  else console.log(chalk.green(JSON.stringify(res, null, '  ')))
  process.exit()
})
.catch((err) => {
  console.error(chalk.red(err))
  process.exit()
})