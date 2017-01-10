import Events from 'events'

export default class Cluster extends Events {
  constructor (server) {
    super()
    this.server = server
  }
}