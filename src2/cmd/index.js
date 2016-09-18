import _ from 'lodash'
import { addRunner } from './add'
import { startRunner } from './start'
import { scheduleRunner } from './schedule'

export default function cmd (command) {
  if (!_.isObject(command)) throw new Error('Invalid command object')

  let { target, action, options } = command

  if (!target) throw new Error('No target specified')
  if (!action) throw new Error('No action specified')

  switch (target) {

    case 'runner':
      switch (action) {
        case 'add':
          return addRunner.call(this, options)
        case 'start':
          return startRunner.call(this, options)
        case 'schedule':
          return scheduleRunner.call(this, options)
        default:
          throw new Error('Invalid action')
      }

    case 'zone':

    case 'queue':

    case 'settings':

    default:
      throw new Error('Invalid targert')
  }
}