export default function (backend) {
  return function (source, args, context, info) {
    let { q } = backend

    return q.type('RunnerSettings')
      .delete()
      .do(() => true)
      .run()
  }
}