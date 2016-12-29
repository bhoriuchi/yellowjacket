import _ from 'lodash'
import factory from 'graphql-factory'
import { GraphQLFactoryRethinkDBBackend } from 'graphql-factory-backend'
import { functions, queries } from '../../graphql/index'
import installData from '../installData'
import basicLogger from '../../common/basicLogger'
import cmd from '../../cmd/index'
import cli from '../../cli/index'
import client from '../../client/index'
import YellowjacketServer from '../../server/index'
import CONST from '../../common/const'
import { prepareConfig } from '../util'

export default class YellowjacketRethinkDBBackend extends GraphQLFactoryRethinkDBBackend {
  constructor (namespace, graphql, r, config = {}, connection) {
    super(namespace, graphql, factory, r, prepareConfig(config), connection)
    this.type = 'YellowjacketRethinkDBBackend'
    this.CONST = CONST
    this.actions = {}
    this.events = {
      local: {},
      socket: {}
    }

    // add actions and scheduler and logger
    let { actions, scheduler, logger } = config

    if (_.isFunction(actions) || _.isObject(actions)) {
      actions = _.isFunction(actions) ? actions(this) : actions
      this.actions = _.merge({}, this.actions, actions)
    }

    if (_.isFunction(scheduler)) this.scheduler = scheduler
    this.logger = logger
    this.log = logger || basicLogger.call(this)

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

  addEvents (events) {
    if (_.has(events, 'local')) _.merge(this.events.local, events.local)
    if (_.has(events, 'socket')) _.merge(this.events.socket, events.socket)
  }

  client (options) {
    return client(this, options)
  }

  createServer (options) {
    return new YellowjacketServer(this, options)
  }
}