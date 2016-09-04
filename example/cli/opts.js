require('babel-register')

var cfg = {
  options: {

  },
  commands: {
    one: {
      options: {
        oneopt1: {
          type: 'Number'
        },
        oneopt2: {

        }
      }
    },
    two: {
      commands: {
        options: {
          twoopt1: {
            type: 'String'
          }
        },
        commands: {
          subtwo: {
            options: {
              subopt: {
                type: 'String'
              }
            }
          }
        }
      }
    }
  }
}

var opts = require('./nested-opts').default(cfg)

console.log(JSON.stringify(opts.options, null, '  '))