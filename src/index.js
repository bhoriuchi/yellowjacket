import Worker from './worker/index'

export default {
  Worker,
  createWorker (options, leveldown) {
    return new Worker(options, leveldown).run()
  }
}