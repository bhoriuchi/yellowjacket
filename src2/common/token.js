import _ from 'lodash'
import fs from 'fs'
import path from 'path'
import { SIGNING_KEY, SIGNING_ALG } from './const'
import jwt from 'jsonwebtoken'

export class YellowjacketTokenStore {
  constructor (host, port, config) {
    this._config = config || { secret: SIGNING_KEY, algorithm: SIGNING_ALG }
    this._signingKey = this._config.secret || SIGNING_KEY
    this._signingAlg = this._config.algorithm || SIGNING_ALG
    if (_.isString(this._config.privateKey)) this._signingKey = fs.readFileSync(path.resolve(this._config.privateKey))
    this.tokenPayload = { host, port }
    this.tokenOptions = { algorithm: this._signingAlg }
    this.token = jwt.sign(this.tokenPayload, this._signingKey, this.tokenOptions)
  }

  get () {
    return this.token
  }

  renew () {
    this.token = jwt.sign(this.tokenPayload, this._signingKey, this.tokenOptions)
  }

  verify (token) {
    try {
      return jwt.verify(token, this._signingKey)
    } catch (error) {
      return { error }
    }
  }

}

export default function (config) {
  return new YellowjacketTokenStore(config)
}