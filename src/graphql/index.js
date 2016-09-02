import schemas from './schemas'
import types from './types'
import GraphQLFactory from 'graphql-factory'
import FactoryTypePlugin from 'graphql-factory-types'

export default function (backend) {
  let factory = GraphQLFactory(backend._graphql)
  let functions = backend.functions
  return factory.make({ functions, types, schemas }, { plugin: [ FactoryTypePlugin ] })
}