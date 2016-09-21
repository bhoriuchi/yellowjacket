import checkIn from './checkIn'
import createQueue from './createQueue'
import createRunner from './createRunner'
import deleteQueue from './deleteQueue'
import deleteRunner from './deleteRunner'
import getSelf from './getSelf'
import getSettings from './getSettings'
import readQueue from './readQueue'
import readRunner from './readRunner'
import updateQueue from './updateQueue'
import updateRunner from './updateRunner'

export { checkIn }
export { createQueue }
export { createRunner }
export { deleteQueue }
export { deleteRunner }
export { getSelf }
export { getSettings }
export { readQueue }
export { readRunner }
export { updateQueue }
export { updateRunner }

export default function (backend) {
  return {
    checkIn: checkIn.bind(backend),
    createQueue: createQueue.bind(backend),
    createRunner: createRunner.bind(backend),
    deleteQueue: deleteQueue.bind(backend),
    deleteRunner: deleteRunner.bind(backend),
    getSelf: getSelf.bind(backend),
    getSettings: getSettings.bind(backend),
    readQueue: readQueue.bind(backend),
    readRunner: readRunner.bind(backend),
    updateQueue: updateQueue.bind(backend),
    updateRunner: updateRunner.bind(backend)
  }
}