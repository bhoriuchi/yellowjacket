import _ from 'lodash'
import factory from 'graphql-factory'
import { GraphQLFactoryRethinkDBBackend } from 'graphql-factory-backend/rethinkdb'
import { mergeConfig } from '../util'
import { functions, queries } from '../../graphql/index'
import cmd from '../../cmd/index'
import cli from '../../cli/index'

export class YellowjacketRethinkDBBackend extends GraphQLFactoryRethinkDBBackend {
  constructor (namespace, graphql, r, config = {}, connection) {
    config = mergeConfig(config)
    super(namespace, graphql, factory, r, config, connection)
    this.type = 'YellowjacketRethinkDBBackend'

    // add actions and scheduler and logger
    let { actions, scheduler, logger } = config
    this.actions = actions
    if (_.isFunction(scheduler)) this.scheduler = scheduler
    this.logger = logger

    // add custom functions
    this.addFunctions(functions)

    // add queries
    this.addQueries(queries(this))

    // add cmd method
    this.cmd = cmd.bind(this)

    // add the cli method
    this.cli = cli.bind(this)
  }
}

// helper function to instantiate a new backend
export default function (namespace, graphql, factory, r, config, connection) {
  return new YellowjacketRethinkDBBackend(namespace, graphql, factory, r, config, connection)
}