export default {
  fields: {
    id: {
      type: 'String',
      primary: true
    },
    appName: {
      description: 'Name used for application logs',
      type: 'String'
    },
    checkinFrequency: {
      description: 'Time in seconds between runner checkins',
      type: 'Int'
    },
    queueCheckFrequency: {
      description: 'Time in seconds between automatic queue checks',
      type: 'Int'
    },
    offlineAfterPolls: {
      description: 'Number of checkins that can be missed before marking the runner offline',
      type: 'Int'
    }
  },
  _backend: {
    schema: 'Yellowjacket',
    collection: 'runner_settings',
    query: {
      read: { type: 'RunnerSettings', resolve: 'readRunnerSettings' }
    },
    mutation: {
      create: { resolve: 'createRunnerSettings' },
      update: { resolve: 'updateRunnerSettings' },
      delete: { resolve: 'deleteRunnerSettings' }
    }
  }
}