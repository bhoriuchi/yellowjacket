import _ from 'lodash'
import FactoryTypePlugin from 'graphql-factory-types'
import { types } from '../graphql/index'

export function mergeConfig (config = {}) {
  // merge plugins
  let plugin = _.union([ FactoryTypePlugin ], _.isArray(config.plugin) ? config.plugin : [])

  // merge passed config with required config
  return _.merge({}, config, { types, plugin })
}

export default {
  mergeConfig
}