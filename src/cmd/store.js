import _ from 'lodash'
import fs from 'fs'
import path from 'path'

export function installStore (options) {
  let { data } = options

  // if the data is a file path, get the data from the file
  data = _.isString(data) ? JSON.parse(fs.readFileSync(path.resolve(data))) : data
  this.addInstallData(data)

  return this.initAllStores(true, this._installData)
}

export default {
  installStore
}