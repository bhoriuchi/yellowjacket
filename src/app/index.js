/*
 * yellowjacket command line builder
 *
 * This module exports a function that expects a yellowjacket backend as its first argument
 * optionally if you do not want to use the cli an options hash can be passed as the second argument
 *
 */
import gql from '../graphql'
import getOptions from './options'
import add from './add'
import start from './start'
import list from './list'
import status from './status'
import { pretty, makeError } from './common'

export default function (backend, options, actions, scheduler) {
  options = options || getOptions()
  let error = makeError(options)

  if (!backend) error('A backend is required but was not supplied')

  let lib = gql(backend)
  let helper = { options, error, pretty}

  switch (options.target) {
    case 'runner':
      if (options.action === 'list') return list(options.target, lib, helper)
      if (options.action === 'add') return add(lib, helper)
      if (options.action === 'start') return start(lib, helper, actions, scheduler)
      if (options.action === 'status') return status(lib, helper)
      return error(`Invalid ${options.target} options`, true)
    case 'zone':
      if (options.options && options.options.list) return list(options.target, lib, helper)
      return error(`Invalid ${options.target} options`, true)
    case 'queue':
      if (options.options && options.options.list) return list(options.target, lib, helper)
      return error(`Invalid ${options.target} options`, true)
    case 'settings':
      if (options.options && options.options.list) return list(options.target, lib, helper)
      return error(`Invalid ${options.target} options`, true)
    default:
      error('Invalid options', true)
  }
}