import chalk from 'chalk'
import NestedOpts from 'nested-opts'

let config = {
  options: {
    error (err) {
      console.error(chalk.red('ERROR:', err.message || err))
      process.exit()
    }
  },
  commands: {
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
            id: { type: 'String' },
            host: { type: 'String' },
            port : { type: 'Int' }
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
            id: { type: 'String' },
            host: { type: 'String' },
            port: { type: 'Int' }
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


export default function () {
  let options = {}
  let opts = NestedOpts(config).options

  if (!opts.valid) return

  options.target = opts.command
  if (opts.subcommand) {
    options.action = opts.subcommand.command
    options.options = opts.subcommand.options
  } else if (opts.options) {
    options.options = opts.options
  }
  options.showHelp = () => 'placeholder for showhelp'
  return options
}