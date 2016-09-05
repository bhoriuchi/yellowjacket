import _ from 'lodash'

export default function getSelf () {
  console.log('port', this._port)
  return this._lib.Runner(`{
  readRunner (
    host: "${this._host}",
    port: ${this._port}
  )
  {
    id,
    state
  }
}`)
    .then((result) => {
      let runner = _.get(result, 'data.readRunner[0]')
      if (result.errors) throw new Error(result.errors)
      if (!runner) throw new Error(`Runner with host:port ${this._server} must be added first`)
      return runner
    })
}