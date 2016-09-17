import checkIn from './checkIn'
import createQueue from './createQueue'
import getSelf from './getSelf'
import getSettings from './getSettings'
import readRunner from './readRunner'
import updateQueue from './updateQueue'

export { checkIn }
export { createQueue }
export { getSelf }
export { getSettings }
export { readRunner }
export { updateQueue }

export default function (backend) {
  return {
    checkIn: checkIn.bind(backend),
    createQueue: createQueue.bind(backend),
    getSelf: getSelf.bind(backend),
    getSettings: getSettings.bind(backend),
    readRunner: readRunner.bind(backend),
    updateQueue: updateQueue.bind(backend)
  }
}