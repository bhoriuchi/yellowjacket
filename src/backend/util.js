import _ from 'lodash'
import FactoryTypePlugin from 'graphql-factory-types'
import { types as typeDefinitions } from '../graphql/index'
import { union } from '../common/util'

const BACKEND_EXT = '_backend'

export function prepareConfig (config) {
  // merge plugins
  let { plugin, options } = config
  let schemaNames = _.union(_.get(options, 'schemas', []), ['Yellowjacket'])
  let backendExtension = _.get(options, 'backendExtension', BACKEND_EXT)

  // clone the type definitions
  let types = _.cloneDeep(typeDefinitions)

  // move the backend extension if set
  _.forEach(types, (definition) => {
    let _backend = _.get(definition, BACKEND_EXT)
    if (_.isObject(_backend) && backendExtension !== BACKEND_EXT) {
      definition[backendExtension] = _backend
      delete definition._backend
    }
  })

  // add custom schema names
  _.forEach(types, (definition) => {
    if (_.has(definition, `["${backendExtension}"]`)) {
      definition[backendExtension].schema = schemaNames
    }
  })

  // merge config
  return _.merge({}, config, {
    types,
    plugin: union(plugin, FactoryTypePlugin),
    extension: backendExtension
  })
}

export default {
  prepareConfig
}