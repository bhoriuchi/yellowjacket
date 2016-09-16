export default {
  fields: {
    id: {
      type: 'String'
    },
    created: {
      description: 'When the run was created',
      type: 'FactoryDateTime'
    },
    updated: {
      description: 'Last time the queue item was updated',
      type: 'FactoryDateTime'
    },
    runner: {
      description: 'Runner the run is currently assigned to',
      type: 'String'
    },
    state: {
      description: 'State of the run',
      type: 'RunnerQueueStateEnum'
    },
    forwarded: {
      description: 'Count of how many times the task has been forwarded',
      type: 'Int'
    },
    action: {
      description: 'Action name to execute when task is run',
      type: 'String'
    },
    context: {
      description: 'Action context',
      type: 'FactoryJSON'
    }
  },
  _backend: {
    schema: 'YJRunner',
    collection: 'runner_queue',
    mutation: {
      create: {
        before (source, args, context, info) {
          let { backend: { util: { now } } } = this
          args.created = now()
          args.updated = now()
        }
      },
      update: {
        before (source, args, context, info) {
          let { backend: { util: { now } } } = this
          args.updated = now()
        }
      }
    }
  }
}