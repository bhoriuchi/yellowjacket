/*
 * yellowjacket backend for RethinkDB
 */
import _ from 'lodash'
import { createTable, DEFAULT_TABLES, now } from './common'
import { createQueue, readQueue, updateQueue, deleteQueue } from './queue'
import { createRunner, readRunner, updateRunner, deleteRunner } from './runner'
import { createZone, readZone, updateZone, deleteZone } from './zone'

function RethinkDBBackend (r, graphql, opts = {}, connection) {
  this._r = r
  this._graphql = graphql
  this._connection = connection
  this._db = r.db(opts.db || 'test')
  this._prefix = opts.prefix || ''
  this._tables = {}
  this.functions = {}

  // set the tables with either the custom or default
  _.forEach(DEFAULT_TABLES, (table, type) => {
    this._tables[type] = {
      table: `${this._prefix}${_.get(opts, `tables.${type}.table`, table.table)}`,
      unique: _.get(opts, `tables.${type}.unique`, table.unique)
    }
  })

  this.functions = {
    now: now(this),

    // queue
    createQueue: createQueue(this),
    readQueue: readQueue(this),
    updateQueue: updateQueue(this),
    deleteQueue: deleteQueue(this),

    // node
    createRunner: createRunner(this),
    readRunner: readRunner(this),
    updateRunner: updateRunner(this),
    deleteRunner: deleteRunner(this),

    // zone
    createZone: createZone(this),
    readZone: readZone(this),
    updateZone: updateZone(this),
    deleteZone: deleteZone(this)
  }
}

RethinkDBBackend.prototype.initStore = function (type, rebuild, seedData) {
  let dbc = this._db
  let tableName = _.get(this._tables, `${type}.table`)
  if (!tableName) throw new Error('Invalid table config')

  // analyze the arguments
  if (!_.isBoolean(rebuild)) {
    seedData = _.isArray(rebuild) ? rebuild : []
    rebuild = false
  }

  return dbc.tableList()
    .filter((name) => name.eq(tableName))
    .forEach((name) => rebuild ? dbc.tableDrop(name) : dbc.table(tableName).delete())
    .run(this._connection)
    .then(() => createTable(dbc, tableName))
}

RethinkDBBackend.prototype.initAllStores = function (rebuild, seedData) {
  if (!_.isBoolean(rebuild)) {
    seedData = _.isObject(rebuild) ? rebuild : {}
    rebuild = false
  }

  let ops = _.map(this._tables, (t, type) => {
    let data = _.get(seedData, type, [])
    return this.initStore(type, rebuild, _.isArray(data) ? data : [])
  })

  return Promise.all(ops)
}

RethinkDBBackend.prototype.install = function () {
  return this.initAllStores(true)
}

export default RethinkDBBackend