let { OFFLINE } = './common'

export default function offlineNode (id) {
  this._peers[id] = { state: OFFLINE }
  this._hb[id].disconnect(0)
  delete this._hb[id]
  return this._lib.Runner(`mutation Mutation {
  updateRunner (
    id: "${id}",
    roles: [],
    state: ${OFFLINE}
  )
} { id }`)
}