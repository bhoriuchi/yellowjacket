import _ from 'lodash'

export function union (a, b) {
  a = a ? a : []
  a = _.isArray(a) ? a : [a]
  b = b ? b : []
  b = _.isArray(b) ? b : [b]
  return _.union(a, b)
}

export default {
  union
}