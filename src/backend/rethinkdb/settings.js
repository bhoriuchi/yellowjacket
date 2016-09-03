export function createSettings (backend) {
  let r = backend._r
  let table = backend._db.table(backend._tables.RunnerSettings.table)
  let connection = backend._connection
  return function (source, args, context, info) {
    return table.count()
      .gt(0)
      .branch(
        r.error('A settings document has already been created'),
        table.insert(args, { returnChanges: true })('changes')
          .nth(0)('new_val')
      )
      .run(connection)
  }
}

export function readSettings (backend) {
  let r = backend._r
  let table = backend._db.table(backend._tables.RunnerSettings.table)
  let connection = backend._connection
  return function (source, args, context, info) {
    return table.count()
      .eq(0)
      .branch(
        r.error('A settings document has not been created yet'),
        table.nth(0)
      )
      .run(connection)
  }
}

export function updateSettings (backend) {
  let r = backend._r
  let table = backend._db.table(backend._tables.RunnerSettings.table)
  let connection = backend._connection
  return function (source, args, context, info) {
    return table.count()
      .eq(0)
      .branch(
        r.error('A settings document has not been created yet'),
        table.nth(0)
          .update(args)
          .do(() => table.nth(0))
      )
      .run(connection)
  }
}

export function deleteSettings (backend) {
  let table = backend._db.table(backend._tables.RunnerSettings.table)
  let connection = backend._connection
  return function (source, args, context, info) {
    return table.delete()
      .do(() => true)
      .run(connection)
  }
}

export default {
  createSettings,
  readSettings,
  updateSettings,
  deleteSettings
}