import YellowJacketServer from '../server/index'

export function startRunner (options) {
  return YellowJacketServer(this, options)
}

export default {
  startRunner
}