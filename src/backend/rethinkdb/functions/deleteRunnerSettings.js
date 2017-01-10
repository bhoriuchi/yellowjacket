export default function (backend) {
  return function (source, args, context, info) {
    let { _connection } = backend
    let collection = backend.getCollection('RunnerSettings')

    return collection.delete({ returnChanges: true })
      .pluck('errors', 'first_error')
      .do((summary) => {
        return summary('errors').ne(0)
          .branch(
            r.error(summary('first_error')),
            true
          )
      })
      .run(_connection)
  }
}