import _ from 'lodash'

export default function checkin () {
  this.logTrace(`Checking in ${this._host}:${this._port}`)
  setTimeout(() => this.checkin(), this._checkinFrequency * 1000)

  return this._lib.Runner(`mutation Mutation {
  checkinRunner (
    id: "${this._id}",
    state: ${this._state},
    offlineAfter: ${this._offlineAfter}
  )
}`)
    .then((result) => {
      let runner = _.get(result, 'data.checkinRunner')
      console.log('got errors', result.errors)
      if (result.errors) throw new Error(result.errors)
      if (!runner) throw new Error(`Runner with host:port ${this._host}:${this._port} was unable to checkin`)
      return runner
    })
}