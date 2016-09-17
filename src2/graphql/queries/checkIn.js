import _ from 'lodash'
import { ONE_SECOND_IN_MS } from '../../common/const'

export default function checkIn (first) {
  this.log.trace(first ? `first check in for ${this._server}` : `checking in ${this._server}`)

  // run the checkIn on an interval
  setTimeout(() => checkIn.call(this), this._checkinFrequency * ONE_SECOND_IN_MS)

  return this._lib.Runner(`
  mutation Mutation {
    checkinRunnerNode (
      id: "${this._id}",
      state: ${this._state},
      offlineAfter: ${this._offlineAfter}
    )
  }`)
    .then((result) => {
      let runner = _.get(result, 'data.checkinRunnerNode')
      if (result.errors) throw new Error(result.errors)
      if (!runner) throw new Error(`Runner with host:port ${this._server} was unable to check in`)
      return runner
    })
}