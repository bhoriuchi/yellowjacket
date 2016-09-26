export default function (backend) {
  return function (source, args, context, info) {
    let { q } = backend

    return q.type('RunnerSettings')
      .count()
      .gt(0)
      .branch(
        q.error('a settings document has already been created'),
        q.type('RunnerSettings').insert(args).value()
      )
      .run()
  }
}