import checkIn from './checkIn'
import createQueue from './createQueue'
import deleteQueue from './deleteQueue'
import getSelf from './getSelf'
import getSettings from './getSettings'
import readQueue from './readQueue'
import readRunner from './readRunner'
import updateQueue from './updateQueue'

export { checkIn }
export { createQueue }
export { deleteQueue }
export { getSelf }
export { getSettings }
export { readQueue }
export { readRunner }
export { updateQueue }

export default function (backend) {
  return {
    checkIn: checkIn.bind(backend),
    createQueue: createQueue.bind(backend),
    deleteQueue: deleteQueue.bind(backend),
    getSelf: getSelf.bind(backend),
    getSettings: getSettings.bind(backend),
    readQueue: readQueue.bind(backend),
    readRunner: readRunner.bind(backend),
    updateQueue: updateQueue.bind(backend)
  }
}