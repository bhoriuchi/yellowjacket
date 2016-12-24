import _ from 'lodash'

export default function getSettings () {

  this.log.trace({ server: this._server }, `getting global settings`)

  return this.lib.Yellowjacket(`
    {
      readRunnerSettings {
        appName,
        checkinFrequency,
        offlineAfterPolls
      }
    }`)
    .then((result) => {
      let settings = _.get(result, 'data.readRunnerSettings')
      if (result.errors) throw new Error(result.errors)
      if (!settings) throw new Error(`No settings document was found`)
      return settings
    })
}