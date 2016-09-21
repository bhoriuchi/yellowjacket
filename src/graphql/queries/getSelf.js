import _ from 'lodash'

export default function getSelf () {

  this.log.trace({ server: this._server }, `getting self`)

  return this.lib.YJRunner(`
    {
      readRunnerNode (
        host: "${this._host}",
        port: ${this._port}
      )
      {
        id,
        state
      }
    }`)
    .then((result) => {
      let runner = _.get(result, 'data.readRunnerNode[0]')
      if (result.errors) throw new Error(result.errors)
      if (!runner) throw new Error(`Runner with host:port ${this._server} must be added first`)
      return runner
    })
}