export default {
  fields: {
    id: {
      type: 'String'
    },
    name: {
      description: 'Zone name',
      type: 'String',
      unique: true
    },
    description: {
      description: 'Describe the zone',
      type: 'String'
    },
    metadata: {
      description: 'Generic supporting data',
      type: 'FactoryJSON'
    }
  },
  _backend: {
    schema: 'YJRunner',
    collection: 'runner_zone'
  }
}