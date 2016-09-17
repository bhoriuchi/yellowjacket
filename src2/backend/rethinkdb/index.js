import factory from 'graphql-factory'
import { GraphQLFactoryRethinkDBBackend } from 'graphql-factory-backend/rethinkdb'
import { mergeConfig } from '../util'
import { functions } from '../../graphql/index'

export class YellowjacketRethinkDBBackend extends GraphQLFactoryRethinkDBBackend {
  constructor (namespace, graphql, r, config = {}, connection) {
    super(namespace, graphql, factory, r, mergeConfig(config), connection)
    this.type = 'YellowjacketRethinkDBBackend'

    // add custom functions
    this.addFunctions(functions)
  }
}

// helper function to instantiate a new backend
export default function (namespace, graphql, factory, r, config, connection) {
  return new YellowjacketRethinkDBBackend(namespace, graphql, factory, r, config, connection)
}