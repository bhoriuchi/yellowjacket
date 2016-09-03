import _ from 'lodash'
import StateEnum from '../../graphql/types/RunnerNodeStateEnum'
let { OFFLINE } = StateEnum.values

export function createRunner (backend) {
  let r = backend._r
  let table = backend._db.table(backend._tables.RunnerNode.table)
  let connection = backend._connection
  return function (source, args, context, info) {
    args.state = OFFLINE

    return table.filter((runner) => {
      return runner('host').match(`(?i)^${args.host}$`)
        .and(runner('port').eq(args.port))
    })
      .count()
      .ne(0)
      .branch(
        r.error(`A node has already been added with host:port ${args.host}:${args.port}`),
        table.insert(args, { returnChanges: true })('changes')
          .nth(0)('new_val')
      )
      .run(connection)
  }
}

export function readRunner (backend) {
  let zone = backend._db.table(backend._tables.RunnerZone.table)
  let table = backend._db.table(backend._tables.RunnerNode.table)
  let connection = backend._connection
  return function (source, args, context, info) {
    if (!_.keys(args).length) return table.run(connection)
    if (args.id) return table.filter({ id: args.id }).run(connection)
    let filter = table

    if (args.zone) {
      filter = table.merge((node) => {
        return {
          zone: node.hasFields('zone').branch(zone.get(node('zone')), { id: null })
        }
      })
        .filter((node) => node('zone')('id').eq(args.zone))
    } else if (args.state) {
      filter = table.filter({ state: args.state })
    } else if (args.host && args.port) {
      filter = table.filter((node) => {
        return node('host').match(`(?i)^${args.host}$`).and(node('port').eq(args.port))
      })
    } else if (args.host) {
      filter = table.filter((node) => node('host').match(`(?i)^${args.host}$`))
    } else if (args.port) {
      filter = table.filter({ port: args.port })
    }
    return filter.run(connection)
  }
}

export function updateRunner (backend) {
  let r = backend._r
  let table = backend._db.table(backend._tables.RunnerNode.table)
  let connection = backend._connection
  return function (source, args, context, info) {
    let { GraphQLError } = info.graphql
    return table.get(args.id).run(connection).then((runner) => {
      if (!runner) throw new GraphQLError(`No runner found with ID ${args.id}`)
      let host = args.host || runner.host
      let port = args.port || runner.port

      // check that a duplicate host and port are not being added
      return table.filter((n) => {
        return n('host').match(`(?i)^${host}$`)
          .and(n('port').eq(port))
          .and(n('id').ne(args.id))
      })
        .count()
        .ne(0)
        .branch(
          r.error(`Runner with host:port ${host}:${port} has already been added`),
          table.get(args.id).update(_.omit(args, 'id'))
            .do(() => table.get(args.id))
        )
        .run(connection)
    })
  }
}

export function deleteRunner (backend) {
  let table = backend._db.table(backend._tables.RunnerNode.table)
  let connection = backend._connection
  return function (source, args, context, info) {
    return table.get(args.id)
      .delete()
      .do(() => true)
      .run(connection)
  }
}

// function to check in a runner state and update others that are past their poll
export function checkinRunner (backend) {
  let r = backend._r
  let table = backend._db.table(backend._tables.RunnerNode.table)
  let connection = backend._connection
  return function (source, args, context, info) {
    return table.get(args.id)
      .eq(null)
      .branch(
        r.error(`Runner ${args.id} not found`),
        table.get(args.id).update({
          checkin: r.now(),
          state: args.state
        })
          .do(() => {
            return table.filter((node) => {
              return node('id')
                .ne(args.id)
                .and(
                  node('checkin')
                    .eq(null)
                    .or(
                      r.now().sub(node('checkin')).ge(args.offlineAfter)
                    )
                )
            })
              .update({ state: 'OFFLINE' })
          })
          .do(() => true)
          .run(connection)
      )
  }
}

export default {
  createRunner,
  readRunner,
  updateRunner,
  deleteRunner,
  checkinRunner
}