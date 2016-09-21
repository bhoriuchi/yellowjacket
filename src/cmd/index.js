import _ from 'lodash'
import {
  listRunner,
  addRunner,
  removeRunner,
  updateRunner,
  startRunner,
  scheduleRunner,
  maintenanceRunner
} from './runner'
import { installStore } from './store'

export default function cmd (command) {
  return new Promise ((resolve, reject) => {
    if (!_.isObject(command)) return reject(Error('Invalid command object'))

    let { target, action, options } = command
    action = action || null

    if (!target) return reject(Error('No target specified'))

    switch (target) {

      case 'runner':
        switch (action) {
          case 'list':
            return resolve(listRunner.call(this, options))
          case 'add':
            return resolve(addRunner.call(this, options))
          case 'remove':
            return resolve(removeRunner.call(this, options))
          case 'update':
            return resolve(updateRunner.call(this, options))
          case 'maintenance':
            return resolve(maintenanceRunner.call(this, options))
          case 'start':
            return resolve(startRunner.call(this, options))
          case 'schedule':
            return resolve(scheduleRunner.call(this, options))
          default:
            return reject(Error('Invalid action'))
        }

      case 'zone':

      case 'queue':

      case 'settings':

      case 'store':
        switch (action) {
          case 'install':
            return resolve(installStore.call(this, options))
          default:
            return reject(Error('Invalid action'))
        }
      default:
        return reject(Error('Invalid targert'))
    }
  })
}