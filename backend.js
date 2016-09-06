'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var _ = _interopDefault(require('lodash'));

var DEFAULT_TABLES = {
  RunnerNode: {
    table: 'runner_node',
    unique: []
  },
  RunnerQueue: {
    table: 'runner_queue',
    unique: []
  },
  RunnerSettings: {
    table: 'runner_settings',
    unique: []
  },
  RunnerZone: {
    table: 'runner_zone',
    unique: []
  }
};

// create a table
function createTable(dbc, name) {
  return dbc.tableCreate(name).run().then(function () {
    return name + ' Created';
  }).catch(function (err) {
    if (err.msg.match(/^Table.*already\s+exists\.$/i) !== null) return name + ' Exists';
    throw err;
  });
}

function now(backend) {
  return function () {
    return backend._r.now().run(backend._connection);
  };
}

function createQueue(backend) {
  var r = backend._r;
  var table = backend._db.table(backend._tables.RunnerQueue.table);
  var connection = backend._connection;
  return function (source, args, context, info) {
    args.created = r.now();
    args.updated = r.now();
    return table.insert(args, { returnChanges: true })('changes').nth(0)('new_val').run(connection);
  };
}

function readQueue(backend) {
  var table = backend._db.table(backend._tables.RunnerQueue.table);
  var connection = backend._connection;
  return function (source, args, context, info) {
    var filter = table;
    if (args.id || args.state || args.runner) filter = table.filter(args);
    return filter.run(connection);
  };
}

function updateQueue(backend) {
  var r = backend._r;
  var table = backend._db.table(backend._tables.RunnerQueue.table);
  var connection = backend._connection;
  return function (source, args, context, info) {
    args.updated = r.now();
    return table.get(args.id).update(_.omit(args, 'id')).do(function () {
      return table.get(args.id);
    }).run(connection);
  };
}

function deleteQueue(backend) {
  var table = backend._db.table(backend._tables.RunnerQueue.table);
  var connection = backend._connection;
  return function (source, args, context, info) {
    return table.get(args.id).delete().do(function () {
      return true;
    }).run(connection);
  };
}

var StateEnum = {
  type: 'Enum',
  values: {
    ONLINE: 'ONLINE',
    OFFLINE: 'OFFLINE',
    MAINTENANCE: 'MAINTENANCE',
    UNKNOWN: 'UNKNOWN'
  }
};

var _StateEnum$values = StateEnum.values;
var OFFLINE = _StateEnum$values.OFFLINE;
var MAINTENANCE = _StateEnum$values.MAINTENANCE;


function createRunner(backend) {
  var r = backend._r;
  var table = backend._db.table(backend._tables.RunnerNode.table);
  var connection = backend._connection;
  return function (source, args, context, info) {
    args.state = OFFLINE;

    return table.filter(function (runner) {
      return runner('host').match('(?i)^' + args.host + '$').and(runner('port').eq(args.port));
    }).count().ne(0).branch(r.error('A node has already been added with host:port ' + args.host + ':' + args.port), table.insert(args, { returnChanges: true })('changes').nth(0)('new_val')).run(connection);
  };
}

function readRunner(backend) {
  var zone = backend._db.table(backend._tables.RunnerZone.table);
  var table = backend._db.table(backend._tables.RunnerNode.table);
  var connection = backend._connection;
  return function (source, args, context, info) {
    if (!_.keys(args).length) return table.run(connection);
    if (args.id) return table.filter({ id: args.id }).run(connection);
    var filter = table;

    if (args.zone) {
      filter = table.merge(function (node) {
        return {
          zone: node.hasFields('zone').branch(zone.get(node('zone')), { id: null })
        };
      }).filter(function (node) {
        return node('zone')('id').eq(args.zone);
      });
    } else if (args.state) {
      filter = table.filter({ state: args.state });
    } else if (args.host && args.port) {
      filter = table.filter(function (node) {
        return node('host').match('(?i)^' + args.host + '$').and(node('port').eq(args.port));
      });
    } else if (args.host) {
      filter = table.filter(function (node) {
        return node('host').match('(?i)^' + args.host + '$');
      });
    } else if (args.port) {
      filter = table.filter({ port: args.port });
    }
    return filter.run(connection);
  };
}

function updateRunner(backend) {
  var r = backend._r;
  var table = backend._db.table(backend._tables.RunnerNode.table);
  var connection = backend._connection;
  return function (source, args, context, info) {
    var GraphQLError = info.graphql.GraphQLError;

    return table.get(args.id).run(connection).then(function (runner) {
      if (!runner) throw new GraphQLError('No runner found with ID ' + args.id);
      var host = args.host || runner.host;
      var port = args.port || runner.port;

      // check that a duplicate host and port are not being added
      return table.filter(function (n) {
        return n('host').match('(?i)^' + host + '$').and(n('port').eq(port)).and(n('id').ne(args.id));
      }).count().ne(0).branch(r.error('Runner with host:port ' + host + ':' + port + ' has already been added'), table.get(args.id).update(_.omit(args, 'id')).do(function () {
        return table.get(args.id);
      })).run(connection);
    });
  };
}

function deleteRunner(backend) {
  var table = backend._db.table(backend._tables.RunnerNode.table);
  var connection = backend._connection;
  return function (source, args, context, info) {
    return table.get(args.id).delete().do(function () {
      return true;
    }).run(connection);
  };
}

// function to check in a runner state and update others that are past their poll
function checkinRunner(backend) {
  var r = backend._r;
  var table = backend._db.table(backend._tables.RunnerNode.table);
  var connection = backend._connection;
  return function (source, args, context, info) {
    return table.get(args.id).eq(null).branch(r.error('Runner ' + args.id + ' not found'), table.get(args.id).update({
      checkin: r.now(),
      state: args.state
    }).do(function () {
      return table.filter(function (node) {
        return node('id').ne(args.id).and(node('state').ne(MAINTENANCE)).and(node('checkin').eq(null).or(r.now().sub(node('checkin')).ge(args.offlineAfter)));
      }).update({ state: 'OFFLINE' });
    }).do(function () {
      return true;
    }).run(connection));
  };
}

function createSettings(backend) {
  var r = backend._r;
  var table = backend._db.table(backend._tables.RunnerSettings.table);
  var connection = backend._connection;
  return function (source, args, context, info) {
    return table.count().gt(0).branch(r.error('A settings document has already been created'), table.insert(args, { returnChanges: true })('changes').nth(0)('new_val')).run(connection);
  };
}

function readSettings(backend) {
  var r = backend._r;
  var table = backend._db.table(backend._tables.RunnerSettings.table);
  var connection = backend._connection;
  return function (source, args, context, info) {
    return table.count().eq(0).branch(r.error('A settings document has not been created yet'), table.nth(0)).run(connection);
  };
}

function updateSettings(backend) {
  var r = backend._r;
  var table = backend._db.table(backend._tables.RunnerSettings.table);
  var connection = backend._connection;
  return function (source, args, context, info) {
    return table.count().eq(0).branch(r.error('A settings document has not been created yet'), table.nth(0).update(args).do(function () {
      return table.nth(0);
    })).run(connection);
  };
}

function deleteSettings(backend) {
  var table = backend._db.table(backend._tables.RunnerSettings.table);
  var connection = backend._connection;
  return function (source, args, context, info) {
    return table.delete().do(function () {
      return true;
    }).run(connection);
  };
}

function createZone(backend) {
  var r = backend._r;
  var table = backend._db.table(backend._tables.RunnerZone.table);
  var connection = backend._connection;
  return function (source, args, context, info) {
    return table.filter(function (zone) {
      return zone('name').match('(?i)^' + args.name + '$');
    }).count().ne(0).branch(r.error('A zone with the name ' + args.name + ' has already been added'), table.insert(args, { returnChanges: true })('changes').nth(0)('new_val')).run(connection);
  };
}

function readZone(backend) {
  var table = backend._db.table(backend._tables.RunnerZone.table);
  var connection = backend._connection;
  return function (source, args, context, info) {
    if (!source && !args.id) return table.run(connection);
    return table.filter({ id: _.get(source, 'zone', args.id) }).run(connection);
  };
}

function updateZone(backend) {
  var r = backend._r;
  var table = backend._db.table(backend._tables.RunnerZone.table);
  var connection = backend._connection;
  return function (source, args, context, info) {
    return table.get(args.id).run(connection).then(function (zone) {
      if (!zone) throw new GraphQLError('No zone found with ID ' + args.id);
      var name = args.name || zone.name;

      // check that a duplicate host and port are not being added
      return table.filter(function (z) {
        return z('name').match('(?i)' + name).and(z('id').ne(args.id));
      }).count().ne(0).branch(r.error('Zone with name ' + name + ' already exists'), table.get(args.id).update(_.omit(args, 'id')).do(function () {
        return table.get(args.id);
      })).run(connection);
    });
  };
}

function deleteZone(backend) {
  var table = backend._db.table(backend._tables.RunnerZone.table);
  var connection = backend._connection;
  return function (source, args, context, info) {
    return table.get(args.id).delete().do(function () {
      return true;
    }).run(connection);
  };
}

/*
 * yellowjacket backend for RethinkDB
 */
function RethinkDBBackend(r, graphql) {
  var _this = this;

  var opts = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];
  var connection = arguments[3];

  this._r = r;
  this._graphql = graphql;
  this._connection = connection;
  this._db = r.db(opts.db || 'test');
  this._prefix = opts.prefix || '';
  this._tables = {};
  this.functions = {};

  // set the tables with either the custom or default
  _.forEach(DEFAULT_TABLES, function (table, type) {
    _this._tables[type] = {
      table: '' + _this._prefix + _.get(opts, 'tables.' + type + '.table', table.table),
      unique: _.get(opts, 'tables.' + type + '.unique', table.unique)
    };
  });

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
    checkinRunner: checkinRunner(this),

    // settings
    createSettings: createSettings(this),
    readSettings: readSettings(this),
    updateSettings: updateSettings(this),
    deleteSettings: deleteSettings(this),

    // zone
    createZone: createZone(this),
    readZone: readZone(this),
    updateZone: updateZone(this),
    deleteZone: deleteZone(this)
  };
}

RethinkDBBackend.prototype.initStore = function (type, rebuild, seedData) {
  var _this2 = this;

  var dbc = this._db;
  var tableName = _.get(this._tables, type + '.table');
  if (!tableName) throw new Error('Invalid table config');

  // analyze the arguments
  if (!_.isBoolean(rebuild)) {
    seedData = _.isArray(rebuild) ? rebuild : [];
    rebuild = false;
  }

  return dbc.tableList().filter(function (name) {
    return name.eq(tableName);
  }).forEach(function (name) {
    return rebuild ? dbc.tableDrop(name) : dbc.table(tableName).delete();
  }).run(this._connection).then(function () {
    return createTable(dbc, tableName);
  }).then(function (tablesCreated) {
    if (seedData) return dbc.table(tableName).insert(seedData).run(_this2._connection).then(function () {
      return tablesCreated;
    });
    return tablesCreated;
  });
};

RethinkDBBackend.prototype.initAllStores = function (rebuild, seedData) {
  var _this3 = this;

  if (!_.isBoolean(rebuild)) {
    seedData = _.isObject(rebuild) ? rebuild : {};
    rebuild = false;
  }

  var ops = _.map(this._tables, function (t, type) {
    var data = _.get(seedData, type, []);
    return _this3.initStore(type, rebuild, _.isArray(data) ? data : []);
  });

  return Promise.all(ops);
};

RethinkDBBackend.prototype.install = function (seedData) {
  return this.initAllStores(true, seedData);
};

var index = {
  rethinkdb: RethinkDBBackend
};

exports.rethinkdb = RethinkDBBackend;
exports['default'] = index;