import _ from 'lodash'
import factory from 'graphql-factory'
import { GraphQLFactoryRethinkDBBackend } from 'graphql-factory-backend'
import { mergeConfig } from '../util'
import { functions, queries } from '../../graphql/index'
import installData from '../installData'
import cmd from '../../cmd/index'
import cli from '../../cli/index'

export class YellowjacketRethinkDBBackend extends GraphQLFactoryRethinkDBBackend {
  constructor (namespace, graphql, r, config = {}, connection) {
    config = mergeConfig(config)
    super(namespace, graphql, factory, r, config, connection)
    this.type = 'YellowjacketRethinkDBBackend'
    this.actions = {}

    // add actions and scheduler and logger
    let { actions, scheduler, logger } = config

    if (_.isFunction(actions) || _.isObject(actions)) {
      actions = _.isFunction(actions) ? actions(this) : actions
      this.actions = _.merge({}, this.actions, actions)
    }

    if (_.isFunction(scheduler)) this.scheduler = scheduler
    this.logger = logger

    // add install data
    this.addInstallData(installData)

    // add custom functions
    this.addFunctions(functions)

    // add queries
    this.addQueries(queries(this))

    // add cmd method
    this.cmd = cmd.bind(this)

    // add the cli method
    this.cli = cli.bind(this)

  }

  addActions (actions) {
    if (!_.isFunction(actions) && !_.isObject(actions)) return
    // if actions is a function it takes the backend as its argument
    // otherwise merge with the existing actions
    actions = _.isFunction(actions) ? actions(this) : actions
    this.actions = _.merge({}, this.actions, actions)
  }
}

// helper function to instantiate a new backend
export default function (namespace, graphql, r, config, connection) {
  return new YellowjacketRethinkDBBackend(namespace, graphql, r, config, connection)
}