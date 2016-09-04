import NestedOpts from 'nested-opts'

let config = {
  options: {},
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
            id: { type: 'String' },
            host: { type: 'String' },
            port: { type: 'Int' },
            loglevel: { type: 'String' },
            logfile: { type: 'String' }
          }
        }
      },
      options: {
        help: true
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