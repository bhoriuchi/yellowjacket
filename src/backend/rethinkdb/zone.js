import _ from 'lodash'

export function createZone (backend) {
  let r = backend._r
  let table = backend._db.table(backend._tables.RunnerZone.table)
  let connection = backend._connection
  return function (source, args, context, info) {
    return table.filter((zone) => zone('name').match(`(?i)^${args.name}$`))
      .count()
      .ne(0)
      .branch(
        r.error(`A zone with the name ${args.name} has already been added`),
        table.insert(args, { returnChanges: true })('changes')
          .nth(0)('new_val')
      )
      .run(connection)
  }
}

export function readZone (backend) {
  let table = backend._db.table(backend._tables.RunnerZone.table)
  let connection = backend._connection
  return function (source, args, context, info) {
    if (!source && !args.id) return table.run(connection)
    return table.filter({ id: _.get(source, 'zone', args.id) }).run(connection)
  }
}

export function updateZone (backend) {
  let r = backend._r
  let table = backend._db.table(backend._tables.RunnerZone.table)
  let connection = backend._connection
  return function (source, args, context, info) {
    return table.get(args.id).run(connection).then((zone) => {
      if (!zone) throw new GraphQLError(`No zone found with ID ${args.id}`)
      let name = args.name || zone.name

      // check that a duplicate host and port are not being added
      return table.filter((z) => {
        return z('name').match(`(?i)${name}`)
          .and(z('id').ne(args.id))
      })
        .count()
        .ne(0)
        .branch(
          r.error(`Zone with name ${name} already exists`),
          table.get(args.id).update(_.omit(args, 'id'))
            .do(() => table.get(args.id))
        )
        .run(connection)
    })
  }
}

export function deleteZone (backend) {
  let table = backend._db.table(backend._tables.RunnerZone.table)
  let connection = backend._connection
  return function (source, args, context, info) {
    return table.get(args.id)
      .delete()
      .do(() => true)
      .run(connection)
  }
}

export default {
  createZone,
  readZone,
  updateZone,
  deleteZone
}