import _ from 'lodash'
import NestedOpts from 'nested-opts'

let config = {
  options: {
    error (err) {
      console.error('ERROR:', err.message || err)
      process.exit()
    }
  },
  commands: {
    store: {
      commands: {
        install: {
          options: {
            data: { type: 'String' }
          }
        }
      }
    },
    runner: {
      commands: {
        add: {
          options: {
            host: { type: 'String' },
            port: { type: 'Int' }
          }
        },
        remove: {
          options: {
            id: { type: 'String' }
          }
        },
        update: {
          options: {
            id: { type: 'String' },
            host: { type: 'String' },
            port: { type: 'Int' },
            zone: { type: 'String' },
            state: { type: 'String' }
          }
        },
        start: {
          options: {
            host: { type: 'String' },
            port: { type: 'Int' },
            loglevel: { type: 'String' },
            logfile: { type: 'String' }
          }
        },
        stop: {
          options: {
            host: { type: 'String' },
            port: { type: 'Int' },
            force: { type: 'Boolean' }
          }
        },
        maintenance: {
          options: {
            host: { type: 'String' },
            port: { type: 'Int' },
            enter: true,
            exit: true,
            reason: { type: 'String' }
          }
        },
        list: {
          options: {
            id: { type: 'String' },
            host: { type: 'String' },
            port: { type: 'Int' },
            state: { type: 'String' },
            zone: { type: 'String' }
          }
        },
        status: {
          options: {
            id: { type: 'String' },
            host: { type: 'String' },
            port: { type: 'Int' }
          }
        },
        schedule: {
          options: {
            id: { type: 'String' },
            host: { type: 'String' },
            port: { type: 'Int' },
            action: { type: 'String' },
            context: { type: 'JSON' }
          }
        }
      },
      options: {
        help: true
      }
    },
    zone: {
      options: {
        list: true
      }
    },
    queue: {
      options: {
        list: true
      }
    },
    settings: {
      options: {
        list: true
      }
    }
  }
}


export default function (customConfig = {}, parser) {
  let options = {}

  // merge a custom config in with the standard one so that the cli can be extended
  let opts = NestedOpts(_.merge({}, customConfig, config)).options

  if (!opts.valid) throw Error('invalid options')

  // allow a custom parser function to return the options object
  if (_.isFunction(parser)) return parser(opts)

  options.target = opts.command
  if (opts.subcommand) {
    options.action = opts.subcommand.command
    options.options = opts.subcommand.options
  } else if (opts.options) {
    options.options = opts.options
  }

  return options
}