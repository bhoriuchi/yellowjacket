import _ from 'lodash'

export default function getSettings () {
  this.logTrace(`Getting global settings ${this._server}`)
  return this._lib.Runner('{ readSettings { appName, checkinFrequency, offlineAfterPolls } }')
    .then((result) => {
      let settings = _.get(result, 'data.readSettings')
      if (result.errors) throw new Error(result.errors)
      if (!settings) throw new Error(`No settings document was found`)
      return settings
    })
}