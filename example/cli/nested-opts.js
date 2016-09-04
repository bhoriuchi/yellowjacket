function isArray (obj) {
  return Array.isArray(obj)
}

function isDate (obj) {
  return obj instanceof Date
}

function isObject (obj) {
  return typeof obj === 'object' && obj !== null
}

function isHash (obj) {
  return isObject(obj) && !isArray(obj) && !isDate(obj)
}

function range (number = 0, increment = 1) {
  return [ ...Array(number).keys() ].map(i => i * increment)
}

function forEach(obj, fn) {
  try {
    if (isArray(obj)) {
      let idx = 0
      for (let val of obj) {
        if (fn(val, idx) === false) break
        idx++
      }
    } else {
      for (const key in obj) {
        if (fn(obj[key], key) === false) break
      }
    }
  } catch (err) {
    return
  }
}

function keys (obj) {
  try {
    return isArray(obj) ? range(obj.length) : Object.keys(obj)
  } catch (err) {
    return []
  }
}

function stringify (obj) {
  try {
    if (isHash(obj) || isArray(obj)) return JSON.stringify(obj)
    else if (has(obj, 'toString')) return obj.toString()
    else return String(obj)
  } catch (err) {}
  return ''
}

export function NestedOpts (config = {}) {

  // instantiate a new nested opts
  if (!(this instanceof NestedOpts)) return new NestedOpts(config)
  this._options = config.options || {}
  this._args = Array.slice(process.argv, 2)
  this.options = { argv: this._args, command: null }

  // keep track of the arg position and result/opt depth
  this._idx = 0
  this._resNest = this.options
  this._optNest = config

  // check for missing values, configuration
  if (!this._args.length) return this
  if (!config.commands) throw new Error('no commands were specified in the configuration')

  // start getting commands
  this.getCommand()
  return this
}

NestedOpts.prototype.currentOption = function () {
  return this._args[this._idx]
}

NestedOpts.prototype.getOption = function () {
  let result = {}
  let opts = this._optNest.options
  if (!opts) return false

  while (this._idx < this._args.length) {
    let val = this._args[this._idx]
    let opt  = opts[val]
    if (opt) {
      if (opt.type) {
        if (this._idx + 1 < this._args.length) {
          result[val] = this._args[this._idx + 1]
          this._idx += 2
        }
        else {
          console.log('Missing argument for', val)
          return false
        }
      } else {
        result[val] = true
        this._idx++
      }
    } else {
      this._idx++
    }
  }
  return keys(result).length ? result : false
}

NestedOpts.prototype.getCommand = function () {
  this._optNest = this._optNest.commands
  forEach(this._optNest, (cmdVal, cmdName) => {
    if (this.currentOption() === cmdName) {
      this._idx++
      this._resNest.command = cmdName
      this._optNest = this._optNest[cmdName]
      this._resNest.options = this.getOption()
      if (this._resNest.options === false && this._optNest.commands) {
        this._optNest = this._optNest.commands
        this._resNest.subcommand = {}
        this._resNest = this._resNest.subcommand
        this.getCommand()
      }
      return false
    }
  })
}

export default NestedOpts