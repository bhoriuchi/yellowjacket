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
        id: { type: 'String' }
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