export default function (backend) {
  return function (source, args, context, info) {
    let { r, _connection } = backend
    let collection = backend.getCollection('RunnerSettings')

    return collection.count().eq(0)
      .branch(
        r.error('a settings document has not been created yet'),
        collection.nth(0)
      )
      .run(_connection)
  }
}