import _ from 'lodash'
import { ONE_SECOND_IN_MS } from './common'

export default function checkin () {
  this.logTrace(`Checking in ${this._server}`)
  setTimeout(() => this.checkin(), this._checkinFrequency * ONE_SECOND_IN_MS)

  return this._lib.Runner(`mutation Mutation {
  checkinRunner (
    id: "${this._id}",
    state: ${this._state},
    offlineAfter: ${this._offlineAfter}
  )
}`)
    .then((result) => {
      let runner = _.get(result, 'data.checkinRunner')
      if (result.errors) throw new Error(result.errors)
      if (!runner) throw new Error(`Runner with host:port ${this._server} was unable to checkin`)
      return runner
    })
}