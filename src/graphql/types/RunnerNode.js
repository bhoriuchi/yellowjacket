export default {
  fields: {
    id: {
      type: 'String'
    },
    host: {
      description: 'Host name or IP address for the runner',
      type: 'String'
    },
    port: {
      description: 'Port the runner listens on',
      type: 'Int'
    },
    zone: {
      description: 'Zone the runner belongs to',
      type: 'RunnerZone',
      resolve: 'readZone'
    },
    state: {
      description: 'Current state of the runner',
      type: 'RunnerNodeStateEnum'
    },
    metadata: {
      description: 'Generic supporting data',
      type: 'FactoryJSON'
    }
  }
}