export default {
  fields: {
    createQueue: {
      type: 'RunnerQueue',
      args: {
        state: { type: 'RunnerQueueStateEnum', defaultValue: 'UNSCHEDULED' },
        forwarded: { type: 'Int', defaultValue: 0 },
        action: { type: 'String', nullable: false },
        context: { type: 'FactoryJSON', defaultValue: {} }
      },
      resolve: 'createQueue'
    },
    updateQueue: {
      type: 'RunnerQueue',
      args: {
        id: { type: 'String', nullable: false },
        runner: { type: 'String'},
        state: { type: 'RunnerQueueStateEnum' },
        forwarded: { type: 'Int' },
        context: { type: 'FactoryJSON' }
      },
      resolve: 'updateQueue'
    },
    deleteQueue: {
      type: 'Boolean',
      args: {
        id: { type: 'String', nullable: false }
      },
      resolve: 'deleteQueue'
    },
    createRunner: {
      type: 'RunnerNode',
      args: {
        host: { type: 'String', nullable: false },
        port: { type: 'Int', defaultValue: 8080 },
        zone: { type: 'String', defaultValue: null },
        metadata: { type: 'FactoryJSON', defaultValue: {} }
      },
      resolve: 'createRunner'
    },
    updateRunner: {
      type: 'RunnerNode',
      args: {
        id: { type: 'String', nullable: false },
        host: { type: 'String' },
        port: { type: 'Int' },
        zone: { type: 'String' },
        state: { type: 'RunnerNodeStateEnum' },
        checkin: { type: 'FactoryDateTime' },
        metadata: { type: 'FactoryJSON' }
      },
      resolve: 'updateRunner'
    },
    deleteRunner: {
      type: 'Boolean',
      args: {
        id: { type: 'String', nullable: false }
      },
      resolve: 'deleteRunner'
    },
    createSettings: {
      type: 'RunnerSettings',
      args: {
        appName: { type: 'String', defaultValue: 'YELLOWJACKET' },
        checkinFrequency: { type: 'Int', defaultValue: 30 },
        offlineAfterPolls: { type: 'Int', defaultValue: 1 }
      },
      resolve: 'createSettings'
    },
    readSettings: {
      type: 'RunnerSettings',
      resolve: 'readSettings'
    },
    updateSettings: {
      type: 'RunnerSettings',
      args: {
        appName: { type: 'String' },
        checkinFrequency: { type: 'Int' },
        offlineAfterPolls: { type: 'Int' }
      },
      resolve: 'updateSettings'
    },
    deleteSettings: {
      type: 'Boolean',
      resolve: 'deleteSettings'
    },
    createZone: {
      type: 'RunnerZone',
      args: {
        name: { type: 'String', nullable: false },
        description: { type: 'String' },
        metadata: { type: 'FactoryJSON', defaultValue: {} }
      },
      resolve: 'createZone'
    },
    updateZone: {
      type: 'RunnerZone',
      args: {
        id: { type: 'String', nullable: false },
        name: { type: 'String' },
        description: { type: 'String' },
        metadata: { type: 'FactoryJSON' }
      },
      resolve: 'updateZone'
    },
    deleteZone: {
      type: 'Boolean',
      args: {
        id: { type: 'String', nullable: false }
      },
      resolve: 'deleteZone'
    },
    checkinRunner: {
      type: 'Boolean',
      args: {
        id: { type: 'String', nullable: false },
        state: { type: 'RunnerNodeStateEnum', nullable: false },
        offlineAfter: { type: 'Int', nullable: false }
      },
      resolve: 'checkinRunner'
    }
  }
}