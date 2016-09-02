import _ from 'lodash'

export function createQueue (backend) {
  let table = backend._db.table(backend._tables.RunnerQueue.table)
  let connection = backend._connection
  return function (source, args, context, info) {
    return table.insert(args, { returnChanges: true })('changes').nth(0)('new_val').run(connection)
  }
}

export function readQueue (backend) {
  let table = backend._db.table(backend._tables.RunnerQueue.table)
  let connection = backend._connection
  return function (source, args, context, info) {
    return (args.id ? table.filter({ id: args.id }) : table).run(connection)
  }
}

export function updateQueue (backend) {
  let r = backend._r
  let table = backend._db.table(backend._tables.RunnerQueue.table)
  let connection = backend._connection
  return function (source, args, context, info) {
    return table.get(args.id).update(_.omit(args, 'id'))
      .do(() => table.get(args.id))
      .run(connection)
  }
}

export function deleteQueue (backend) {
  let table = backend._db.table(backend._tables.RunnerQueue.table)
  let connection = backend._connection
  return function (source, args, context, info) {
    return table.get(args.id)
      .delete()
      .do(() => true)
      .run(connection)
  }
}

export default {
  createQueue,
  readQueue,
  updateQueue,
  deleteQueue
}