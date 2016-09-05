export default {
  fields: {
    readQueue: {
      type: ['RunnerQueue'],
      args: {
        id: { type: 'String' },
        runner: { type: 'String' },
        state: { type: 'RunnerQueueStateEnum' }
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
    readSettings: {
      type: 'RunnerSettings',
      resolve: 'readSettings'
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