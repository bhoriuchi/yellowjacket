import _ from 'lodash'
import fs from 'fs'
import path from 'path'
import { SIGNING_KEY, SIGNING_ALG, TOKEN_EXPIRES_IN } from './const'
import jwt from 'jsonwebtoken'

export class YellowjacketTokenStore {
  constructor (host, port, config) {
    this._config = config || { secret: SIGNING_KEY }
    this._signingKey = this._config.secret || SIGNING_KEY
    if (_.isString(this._config.privateKey)) this._signingKey = fs.readFileSync(path.resolve(this._config.privateKey))
    this.tokenPayload = { host, port }
    this.tokenOptions = this._config.options || {}
    this.tokenOptions.expiresIn = this.tokenOptions.expiredIn || TOKEN_EXPIRES_IN
    this.token = jwt.sign(this.tokenPayload, this._signingKey, this.tokenOptions)
  }

  get () {
    return this.token
  }

  renew () {
    this.token = jwt.sign(this.tokenPayload, this._signingKey, this.tokenOptions)
    return this.token
  }

  renewIfExpired () {
    let verify = this.verify(this.token)
    if (_.has(verify, 'error') && verify.expired) this.renew()
    return this.token
  }

  verify (token) {
    try {
      return jwt.verify(token, this._signingKey)
    } catch (error) {
      return { error, expired: _.get(error, 'name') === 'TokenExpiredError' }
    }
  }

}

export default function (config) {
  return new YellowjacketTokenStore(config)
}