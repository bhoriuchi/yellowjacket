export default function (backend) {
  return function (source, args, context, info) {
    let { q } = backend

    return q.type('RunnerSettings')
      .count()
      .eq(0)
      .branch(
        q.error('a settings document has not been created yet'),
        q.type('RunnerSettings').nth(0)
          .update(args)
          .do(() => q.type('RunnerSettings').nth(0).value())
          .value()
      )
      .run()
  }
}