import StateEnum from './RunnerNodeStateEnum'
let { OFFLINE } = StateEnum.values

export default {
  fields: {
    id: {
      type: 'String',
      primary: true
    },
    host: {
      description: 'Host name or IP address for the runner',
      type: 'String',
      uniqueWith: 'hostport'
    },
    port: {
      description: 'Port the runner listens on',
      type: 'Int',
      uniqueWith: 'hostport'
    },
    zone: {
      description: 'Zone the runner belongs to',
      type: 'RunnerZone',
      has: 'id'
    },
    state: {
      description: 'Current state of the runner',
      type: 'RunnerNodeStateEnum'
    },
    checkin: {
      description: 'A timestamp of when the last time a node checked in was',
      type: 'FactoryDateTime'
    },
    metadata: {
      description: 'Generic supporting data',
      type: 'FactoryJSON'
    }
  },
  _backend: {
    schema: 'Yellowjacket',
    collection: 'runner_node',
    mutation: {
      create: {
        before (fnArgs, backend, done) {
          let { args } = fnArgs
          if (!args.host) return done(new Error('Missing required field host'))
          if (!args.port) return done(new Error('Missing required field port'))

          delete args.id
          delete args.checkin

          args.state = OFFLINE
          return done()
        }
      },
      checkinRunnerNode: {
        type: 'Boolean',
        args: {
          id: { type: 'String', nullable: false },
          state: { type: 'RunnerNodeStateEnum', nullable: false },
          offlineAfter: { type: 'Int', nullable: false }
        },
        resolve: 'checkinRunnerNode'
      }
    }
  }
}