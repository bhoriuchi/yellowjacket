export default {
  fields: {
    id: {
      type: 'String',
      primary: true
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
    schema: 'Yellowjacket',
    collection: 'runner_queue',
    mutation: {
      create: {
        before (fnArgs, backend, done) {
          try {
            let { args } = fnArgs
            return backend.now((err, now) => {
              if (err) return done(err)
              args.create = now
              args.updated = now
              return done()
            })
          } catch (err) {
            return done(err)
          }
        }
      },
      update: {
        before (fnArgs, backend, done) {
          try {
            let { args } = fnArgs
            return backend.now((err, now) => {
              if (err) return done(err)
              args.updated = now
              return done()
            })
          } catch (err) {
            return done(err)
          }
        }
      }
    }
  }
}