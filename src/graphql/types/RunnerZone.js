export default {
  fields: {
    id: {
      type: 'String'
    },
    name: {
      description: 'Zone name',
      type: 'String'
    },
    description: {
      description: 'Describe the zone',
      type: 'String'
    },
    metadata: {
      description: 'Generic supporting data',
      type: 'FactoryJSON'
    }
  }
}