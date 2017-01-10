import StateEnum from '../../../graphql/types/RunnerNodeStateEnum'
let { OFFLINE, MAINTENANCE } = StateEnum.values

export default function (backend) {
  return function (source, args, context, info) {
    let { r, _connection } = backend
    let { id, state, offlineAfter } = args
    let collection = backend.getCollection('RunnerNode')

    return collection.get(id).eq(null)
      .branch(
        r.error('runner not found'),
        collection.get(id).update({ checkin: r.now(), state })
      )
      .do(() => {
        return collection.filter((node) => {
          return node('id')
            .ne(id)
            .and(node('state').ne(MAINTENANCE))
            .and(
              node('checkin')
                .eq(null)
                .or(r.now().sub(node('checkin')).ge(offlineAfter))
            )
        })
          .update({ state: OFFLINE })
      })
      .do(() => true)


    return q.type('RunnerNode').update({
      id: args.id,
      checkin: q.now().value(),
      state: args.state
    })
      .do(() => {
        return q.type('RunnerNode').filter((node) => {
          return q.value(node)
            .prop('id')
            .ne(args.id)
            .and(q.value(node).prop('state').ne(MAINTENANCE).value())
            .and(
              q.value(node).prop('checkin')
                .eq(null)
                .or(
                  q.now().sub(q.value(node).prop('checkin').value())
                    .ge(args.offlineAfter).value()
                )
                .value()
            )
            .value()
        })
          .update({ state: OFFLINE })
          .value()
      })
      .do(() => true)
      .run(_connection)
  }
}