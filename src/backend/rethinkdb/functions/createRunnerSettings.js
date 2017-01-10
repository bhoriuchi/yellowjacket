export default function (backend) {
  return function (source, args, context, info) {
    let { r, _connection } = backend
    let collection = backend.getCollection('RunnerSettings')

    return collection.count().gt(0).branch(
      r.error('a settings document has already been created'),
      collection.insert(args, { returnChanges: true })
        .pluck('errors', 'first_error', 'changes')
        .do((summary) => {
          return summary('errors').ne(0)
            .branch(
              r.error(summary('first_error')),
              summary.nth(0)('changes')('new_value')
            )
        })
    )
      .run(_connection)
  }
}