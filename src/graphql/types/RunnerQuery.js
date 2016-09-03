export default {
  fields: {
    readQueue: {
      type: ['RunnerQueue'],
      args: {
        id: { type: 'String' }
      },
      resolve: 'readQueue'
    },
    readRunner: {
      type: ['RunnerNode'],
      args: {
        id: { type: 'String' },
        host: { type: 'String' },
        port: { type: 'Int' },
        zone: { type: 'String' },
        state: { type: 'RunnerNodeStateEnum' }
      },
      resolve: 'readRunner'
    },
    readZone: {
      type: ['RunnerZone'],
      args: {
        id: { type: 'String' }
      },
      resolve: 'readZone'
    }
  }
}