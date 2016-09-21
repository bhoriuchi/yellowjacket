import StateEnum from '../../graphql/types/RunnerNodeStateEnum'
let { OFFLINE, MAINTENANCE } = StateEnum.values

export default function (backend) {
  return function (source, args, context, info) {
    let { q } = backend

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
      .run()
  }
}