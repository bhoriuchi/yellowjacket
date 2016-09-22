'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var _ = _interopDefault(require('lodash'));
var factory = _interopDefault(require('graphql-factory'));
var graphqlFactoryBackend = require('graphql-factory-backend');
var FactoryTypePlugin = _interopDefault(require('graphql-factory-types'));
var Events = _interopDefault(require('events'));
var http = _interopDefault(require('http'));
var SocketServer = _interopDefault(require('socket.io'));
var fs = _interopDefault(require('fs'));
var path = _interopDefault(require('path'));
var jwt = _interopDefault(require('jsonwebtoken'));
var SocketClient = _interopDefault(require('socket.io-client'));
var NestedOpts = _interopDefault(require('nested-opts'));

var RunnerNodeStateEnum = {
  type: 'Enum',
  values: {
    ONLINE: 'ONLINE',
    OFFLINE: 'OFFLINE',
    MAINTENANCE: 'MAINTENANCE',
    UNKNOWN: 'UNKNOWN'
  }
};

var _StateEnum$values = RunnerNodeStateEnum.values;
var OFFLINE = _StateEnum$values.OFFLINE;
var MAINTENANCE = _StateEnum$values.MAINTENANCE;


function checkinRunnerNode (backend) {
  return function (source, args, context, info) {
    var q = backend.q;


    return q.type('RunnerNode').update({
      id: args.id,
      checkin: q.now().value(),
      state: args.state
    }).do(function () {
      return q.type('RunnerNode').filter(function (node) {
        return q.value(node).prop('id').ne(args.id).and(q.value(node).prop('state').ne(MAINTENANCE).value()).and(q.value(node).prop('checkin').eq(null).or(q.now().sub(q.value(node).prop('checkin').value()).ge(args.offlineAfter).value()).value()).value();
      }).update({ state: OFFLINE }).value();
    }).do(function () {
      return true;
    }).run();
  };
}

function createRunnerSettings (backend) {
  return function (source, args, context, info) {
    var q = backend.q;


    return q.type('RunnerSettings').count().gt(0).branch(q.error('a settings document has already been created'), q.type('RunnerSettings').insert(args).value()).run();
  };
}

function deleteRunnerSettings (backend) {
  return function (source, args, context, info) {
    var q = backend.q;


    return q.type('RunnerSettings').delete().do(function () {
      return true;
    }).run();
  };
}

function readRunnerSettings (backend) {
  return function (source, args, context, info) {
    var q = backend.q;


    return q.type('RunnerSettings').count().eq(0).branch(q.error('a settings document has not been created yet'), q.type('RunnerSettings').nth(0).value()).run();
  };
}

function updateRunnerSettings (backend) {
  return function (source, args, context, info) {
    var q = backend.q;


    return q.type('RunnerSettings').count().eq(0).branch(q.error('a settings document has not been created yet'), q.type('RunnerSettings').nth(0).update(args).do(function () {
      return q.type('RunnerSettings').nth(0).value();
    }).value()).run();
  };
}

var functions = {
  checkinRunnerNode: checkinRunnerNode,
  createRunnerSettings: createRunnerSettings,
  deleteRunnerSettings: deleteRunnerSettings,
  readRunnerSettings: readRunnerSettings,
  updateRunnerSettings: updateRunnerSettings
};

var ONE_SECOND_IN_MS = 1000;

// log levels
var LOG_LEVELS = {
  fatal: 60,
  error: 50,
  warn: 40,
  info: 30,
  debug: 20,
  trace: 10,
  silent: -1
};

var EVENTS = {
  CONNECTION: 'connection',
  CONNECTED: 'connected',
  CONNECT_ERROR: 'connect_error',
  CONNECT_TIMEOUT: 'connect_timeout',
  DISCONNECT: 'disconnect',
  STATUS: 'status',
  SCHEDULE: 'schedule',
  SCHEDULE_ERROR: 'schedule.error',
  SCHEDULE_ACCEPT: 'schedule.accept',
  RUN: 'run',
  OK: 'ok',
  STOP: 'stop',
  STOP_ERROR: 'stop.error',
  RESTART: 'restart',
  RESTART_ERROR: 'restart.error',
  AUTHENTICATE: 'authenticate',
  TOKEN: 'token',
  AUTHENTICATION_ERROR: 'authentication.error',
  AUTHENTICATED: 'authenticated',
  MAINTENANCE_ENTER: 'maintenance.enter',
  MAINTENANCE_EXIT: 'maintenance.exit',
  MAINTENANCE_ERROR: 'maintenance.error',
  MAINTENANCE_OK: 'maintenance.ok'
};

// defaults for JWT
var SIGNING_KEY = 'twothingsareinfinitetheuniverseandhumanstupidityandimnotsureabouttheuniverse';

function checkIn(first) {
  var _this = this;

  var msg = first ? 'first check in for ' + this._server : 'checking in ' + this._server;
  this.log.trace({ server: this._server }, msg);

  // run the checkIn on an interval
  setTimeout(function () {
    return checkIn.call(_this);
  }, this._checkinFrequency * ONE_SECOND_IN_MS);

  return this.lib.YJRunner('\n  mutation Mutation {\n    checkinRunnerNode (\n      id: "' + this.id + '",\n      state: ' + this.state + ',\n      offlineAfter: ' + this._offlineAfter + '\n    )\n  }').then(function (result) {
    var runner = _.get(result, 'data.checkinRunnerNode');
    if (result.errors) throw new Error(result.errors);
    if (!runner) throw new Error('Runner with host:port ' + _this._server + ' was unable to check in');
    return runner;
  });
}

var RunnerQueueStateEnum = {
  type: 'Enum',
  values: {
    UNSCHEDULED: 'UNSCHEDULED',
    SCHEDULED: 'SCHEDULED',
    RUNNING: 'RUNNING',
    COMPLETE: 'COMPLETE',
    FAILED: 'FAILED',
    RESCHEDULE: 'RESCHEDULE'
  }
};

var UNSCHEDULED = RunnerQueueStateEnum.values.UNSCHEDULED;


function createQueue(action, context) {
  return this.lib.YJRunner('mutation Mutation \n    {\n      createRunnerQueue (\n        action: "' + action + '",\n        context: ' + factory.utils.toObjectString(context) + ',\n        state: ' + UNSCHEDULED + '\n      ) {\n        id,\n        action,\n        context\n      }  \n    }').then(function (result) {
    var queue = _.get(result, 'data.createRunnerQueue');
    if (result.errors) throw new Error(result.errors);
    if (!queue) throw new Error('Could not create queue');
    return queue;
  });
}

function createRunner(args) {
  return this.lib.YJRunner('mutation Mutation\n  {\n    createRunnerNode (' + factory.utils.toObjectString(args, { noOuterBraces: true }) + ')\n    {\n      id,\n      host,\n      port,\n      state,\n      zone { id, name },\n      metadata\n    }\n  }').then(function (result) {
    var runner = _.get(result, 'data.createRunnerNode');
    if (result.errors) throw result.errors;
    if (!runner) throw new Error('runner not created');
    return runner;
  });
}

function deleteQueue(id) {
  return this.lib.YJRunner('mutation Mutation\n  {\n    deleteRunnerQueue (id: "' + id + '")\n  }').then(function (result) {
    var queue = _.get(result, 'data.deleteRunnerQueue');
    if (result.errors) throw new Error(result.errors);
    if (!queue) throw new Error('queue not deleted');
    return queue;
  });
}

function deleteRunner(id) {
  return this.lib.YJRunner('mutation Mutation\n  {\n    deleteRunnerNode (id: "' + id + '")\n  }').then(function (result) {
    var runner = _.get(result, 'data.deleteRunnerNode');
    if (result.errors) throw new Error(result.errors);
    if (!runner) throw new Error('runner not deleted');
    return runner;
  });
}

function getSelf() {
  var _this = this;

  this.log.trace({ server: this._server }, 'getting self');

  return this.lib.YJRunner('\n    {\n      readRunnerNode (\n        host: "' + this._host + '",\n        port: ' + this._port + '\n      )\n      {\n        id,\n        state\n      }\n    }').then(function (result) {
    var runner = _.get(result, 'data.readRunnerNode[0]');
    if (result.errors) throw new Error(result.errors);
    if (!runner) throw new Error('Runner with host:port ' + _this._server + ' must be added first');
    return runner;
  });
}

function getSettings() {

  this.log.trace({ server: this._server }, 'getting global settings');

  return this.lib.YJRunner('\n    {\n      readRunnerSettings {\n        appName,\n        checkinFrequency,\n        offlineAfterPolls\n      }\n    }').then(function (result) {
    var settings = _.get(result, 'data.readRunnerSettings');
    if (result.errors) throw new Error(result.errors);
    if (!settings) throw new Error('No settings document was found');
    return settings;
  });
}

function readQueue(args) {
  return this.lib.YJRunner('\n  {\n    readRunnerQueue (' + factory.utils.toObjectString(args, { noOuterBraces: true }) + ')\n    {\n      id,\n      created,\n      updated,\n      runner,\n      state,\n      action,\n      context\n    }\n  }').then(function (result) {
    var tasks = _.get(result, 'data.readRunnerQueue');
    if (result.errors) throw new Error(result.errors);
    if (!tasks) throw new Error('No tasks');
    return tasks;
  });
}

function readRunner(args) {

  var filter = _.isObject(args) ? '(' + factory.utils.toObjectString(args, { noOuterBraces: true }) + ')' : '';

  return this.lib.YJRunner('\n  {\n    readRunnerNode ' + filter + '\n    {\n      id,\n      host,\n      port,\n      zone { id, name, description, metadata },\n      state,\n      metadata\n    }\n  }').then(function (result) {
    var runners = _.get(result, 'data.readRunnerNode');
    if (result.errors) throw new Error(result.errors);
    if (!runners) throw new Error('No runners');
    return runners;
  });
}

function updateQueue(args) {
  return this.lib.YJRunner('mutation Mutation\n  {\n    updateRunnerQueue (' + factory.utils.toObjectString(args, { noOuterBraces: true }) + ')\n    {\n      id,\n      runner,\n      state,\n      action,\n      context\n    }\n  }').then(function (result) {
    var queue = _.get(result, 'data.updateRunnerQueue');
    if (result.errors) throw new Error(result.errors);
    if (!queue) throw new Error('queue not updated');
    return queue;
  });
}

function updateRunner(args) {
  return this.lib.YJRunner('mutation Mutation\n  {\n    updateRunnerNode (' + factory.utils.toObjectString(args, { noOuterBraces: true }) + ')\n    {\n      id,\n      host,\n      port,\n      zone { id, name, description, metadata },\n      state,\n      metadata\n    }\n  }').then(function (result) {
    var runner = _.get(result, 'data.updateRunnerNode');
    if (result.errors) throw new Error(result.errors);
    if (!runner) throw new Error('runner not updated');
    return runner;
  });
}

function queries (backend) {
  return {
    checkIn: checkIn.bind(backend),
    createQueue: createQueue.bind(backend),
    createRunner: createRunner.bind(backend),
    deleteQueue: deleteQueue.bind(backend),
    deleteRunner: deleteRunner.bind(backend),
    getSelf: getSelf.bind(backend),
    getSettings: getSettings.bind(backend),
    readQueue: readQueue.bind(backend),
    readRunner: readRunner.bind(backend),
    updateQueue: updateQueue.bind(backend),
    updateRunner: updateRunner.bind(backend)
  };
}

var _StateEnum$values$1 = RunnerNodeStateEnum.values;
var OFFLINE$1 = _StateEnum$values$1.OFFLINE;
var MAINTENANCE$1 = _StateEnum$values$1.MAINTENANCE;


var RunnerNode = {
  fields: {
    id: {
      type: 'String',
      primary: true
    },
    host: {
      description: 'Host name or IP address for the runner',
      type: 'String',
      uniqueWith: 'hostport'
    },
    port: {
      description: 'Port the runner listens on',
      type: 'Int',
      uniqueWith: 'hostport'
    },
    zone: {
      description: 'Zone the runner belongs to',
      type: 'RunnerZone',
      has: 'id'
    },
    state: {
      description: 'Current state of the runner',
      type: 'RunnerNodeStateEnum'
    },
    checkin: {
      description: 'A timestamp of when the last time a node checked in was',
      type: 'FactoryDateTime'
    },
    metadata: {
      description: 'Generic supporting data',
      type: 'FactoryJSON'
    }
  },
  _backend: {
    schema: 'YJRunner',
    collection: 'runner_node',
    mutation: {
      create: {
        before: function before(source, args, context, info) {
          if (!args.host) throw new Error('Missing required field host');
          if (!args.port) throw new Error('Missing required field port');

          delete args.id;
          delete args.checkin;

          args.state = OFFLINE$1;
        }
      },
      checkinRunnerNode: {
        type: 'Boolean',
        args: {
          id: { type: 'String', nullable: false },
          state: { type: 'RunnerNodeStateEnum', nullable: false },
          offlineAfter: { type: 'Int', nullable: false }
        },
        resolve: 'checkinRunnerNode'
      }
    }
  }
};

var RunnerQueue = {
  fields: {
    id: {
      type: 'String',
      primary: true
    },
    created: {
      description: 'When the run was created',
      type: 'FactoryDateTime'
    },
    updated: {
      description: 'Last time the queue item was updated',
      type: 'FactoryDateTime'
    },
    runner: {
      description: 'Runner the run is currently assigned to',
      type: 'String'
    },
    state: {
      description: 'State of the run',
      type: 'RunnerQueueStateEnum'
    },
    forwarded: {
      description: 'Count of how many times the task has been forwarded',
      type: 'Int'
    },
    action: {
      description: 'Action name to execute when task is run',
      type: 'String'
    },
    context: {
      description: 'Action context',
      type: 'FactoryJSON'
    }
  },
  _backend: {
    schema: 'YJRunner',
    collection: 'runner_queue',
    mutation: {
      create: {
        before: function before(source, args, context, info) {
          var q = this.q;

          args.created = q.now().value();
          args.updated = q.now().value();
        }
      },
      update: {
        before: function before(source, args, context, info) {
          var q = this.q;

          args.updated = q.now().value();
        }
      }
    }
  }
};

var RunnerSettings = {
  fields: {
    id: {
      type: 'String',
      primary: true
    },
    appName: {
      description: 'Name used for application logs',
      type: 'String'
    },
    checkinFrequency: {
      description: 'Time in seconds between runner checkins',
      type: 'Int'
    },
    offlineAfterPolls: {
      description: 'Number of checkins that can be missed before marking the runner offline',
      type: 'Int'
    }
  },
  _backend: {
    schema: 'YJRunner',
    collection: 'runner_settings',
    query: {
      read: { type: 'RunnerSettings', resolve: 'readRunnerSettings' }
    },
    mutation: {
      create: { resolve: 'createRunnerSettings' },
      update: { resolve: 'updateRunnerSettings' },
      delete: { resolve: 'deleteRunnerSettings' }
    }
  }
};

var RunnerZone = {
  fields: {
    id: {
      type: 'String',
      primary: true
    },
    name: {
      description: 'Zone name',
      type: 'String',
      unique: true
    },
    description: {
      description: 'Describe the zone',
      type: 'String'
    },
    metadata: {
      description: 'Generic supporting data',
      type: 'FactoryJSON'
    }
  },
  _backend: {
    schema: 'YJRunner',
    collection: 'runner_zone'
  }
};

var types = {
  RunnerNode: RunnerNode,
  RunnerNodeStateEnum: RunnerNodeStateEnum,
  RunnerQueue: RunnerQueue,
  RunnerQueueStateEnum: RunnerQueueStateEnum,
  RunnerSettings: RunnerSettings,
  RunnerZone: RunnerZone
};

function mergeConfig() {
  var config = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

  // merge plugins
  var plugin = _.union([FactoryTypePlugin], _.isArray(config.plugin) ? config.plugin : []);

  // merge passed config with required config
  return _.merge({}, config, { types: types, plugin: plugin });
}

var classCallCheck = function (instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
};

var createClass = function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
}();

var defineProperty = function (obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }

  return obj;
};

var inherits = function (subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
  }

  subClass.prototype = Object.create(superClass && superClass.prototype, {
    constructor: {
      value: subClass,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
  if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
};

var possibleConstructorReturn = function (self, call) {
  if (!self) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  }

  return call && (typeof call === "object" || typeof call === "function") ? call : self;
};

var YellowjacketTokenStore = function () {
  function YellowjacketTokenStore(host, port, config) {
    classCallCheck(this, YellowjacketTokenStore);

    this._config = config || { secret: SIGNING_KEY };
    this._signingKey = this._config.secret || SIGNING_KEY;
    if (_.isString(this._config.privateKey)) this._signingKey = fs.readFileSync(path.resolve(this._config.privateKey));
    this.tokenPayload = { host: host, port: port };
    this.tokenOptions = this._config.options || {};
    this.token = jwt.sign(this.tokenPayload, this._signingKey, this.tokenOptions);
  }

  createClass(YellowjacketTokenStore, [{
    key: 'get',
    value: function get() {
      return this.token;
    }
  }, {
    key: 'renew',
    value: function renew() {
      this.token = jwt.sign(this.tokenPayload, this._signingKey, this.tokenOptions);
    }
  }, {
    key: 'verify',
    value: function verify(token) {
      try {
        return jwt.verify(token, this._signingKey);
      } catch (error) {
        return { error: error };
      }
    }
  }]);
  return YellowjacketTokenStore;
}();

function tokenStore (config) {
  return new YellowjacketTokenStore(config);
}

function logify(level, args) {
  if (_.isObject(_.get(args, '[0]'))) {
    args[0].level = level;
  } else {
    args = [{ level: level }].concat(args);
  }
  return args;
}

// basic logging to the console
function basicLogger () {
  var self = this;
  return {
    fatal: function fatal() {
      if (self._logLevel >= 0 && self._logLevel <= LOG_LEVELS.fatal) {
        console.error.apply(null, logify(LOG_LEVELS.fatal, [].concat(Array.prototype.slice.call(arguments))));
      }
    },
    error: function error() {
      if (self._logLevel >= 0 && self._logLevel <= LOG_LEVELS.error) {
        console.error.apply(null, logify(LOG_LEVELS.error, [].concat(Array.prototype.slice.call(arguments))));
      }
    },
    warn: function warn() {
      if (self._logLevel >= 0 && self._logLevel <= LOG_LEVELS.warn) {
        console.warn.apply(null, logify(LOG_LEVELS.warn, [].concat(Array.prototype.slice.call(arguments))));
      }
    },
    info: function info() {
      if (self._logLevel >= 0 && self._logLevel <= LOG_LEVELS.info) {
        console.info.apply(null, logify(LOG_LEVELS.info, [].concat(Array.prototype.slice.call(arguments))));
      }
    },
    debug: function debug() {
      if (self._logLevel >= 0 && self._logLevel <= LOG_LEVELS.debug) {
        console.log.apply(this, logify(LOG_LEVELS.debug, [].concat(Array.prototype.slice.call(arguments))));
      }
    },
    trace: function trace() {
      if (self._logLevel >= 0 && self._logLevel <= LOG_LEVELS.trace) {
        console.log.apply(null, logify(LOG_LEVELS.trace, [].concat(Array.prototype.slice.call(arguments))));
      }
    }
  };
}

var CONNECTION = EVENTS.CONNECTION;
var AUTHENTICATE = EVENTS.AUTHENTICATE;
var AUTHENTICATION_ERROR = EVENTS.AUTHENTICATION_ERROR;
var AUTHENTICATED = EVENTS.AUTHENTICATED;
var TOKEN = EVENTS.TOKEN;
var STATUS = EVENTS.STATUS;
var SCHEDULE$1 = EVENTS.SCHEDULE;
var RUN = EVENTS.RUN;
var STOP$1 = EVENTS.STOP;
var MAINTENANCE_ENTER$1 = EVENTS.MAINTENANCE_ENTER;
var MAINTENANCE_EXIT$1 = EVENTS.MAINTENANCE_EXIT;


function startListeners() {
  var _this = this;

  var event = this._emitter;
  this.log.info({ method: 'startListeners', server: this._server }, 'socket server is now listening');

  // handle socket events
  this._io.on(CONNECTION, function (socket) {
    var client = _.get(socket, 'conn.remoteAddress', 'unknown');
    _this.log.debug({ server: _this._server, client: client }, 'socket.io connection made');

    // request authentication
    _this.log.trace({ client: client, server: _this._server }, 'emitting authentication request');
    socket.emit(AUTHENTICATE);

    // on receiving a token, attempt to authenticate it
    socket.on(TOKEN, function (token) {
      _this.log.trace({ client: client, token: token, server: _this._server }, 'received token response');

      // verify the token
      var payload = _this.verify(token);

      // if the token is not valid send an error event back
      if (payload.error) {
        _this.log.debug({ client: client, error: payload, server: _this._server }, 'socket authentication failed');
        return socket.emit(AUTHENTICATION_ERROR, payload);
      }

      // add the host to the sockets
      var host = payload.host;
      var port = payload.port;

      if (!_.has(_this._sockets, host + ':' + port)) {
        _.set(_this._sockets, host + ':' + port, { socket: socket, listeners: {} });
      }

      // set up remaining listeners now that we are authenticated
      _this.log.trace({ client: client, server: _this._server }, 'token is valid, setting up listeners');

      socket.emit(AUTHENTICATED);

      socket.on(STATUS, function () {
        _this.log.trace({ client: client, server: _this._server, event: STATUS }, 'received socket event');
        socket.emit(STATUS, _this.info());
      });

      socket.on(SCHEDULE$1, function (payload) {
        _this.log.trace({ client: client, server: _this._server, event: SCHEDULE$1 }, 'received socket event');
        event.emit(SCHEDULE$1, { payload: payload, socket: socket });
      });

      socket.on(RUN, function () {
        _this.log.trace({ client: client, server: _this._server, event: RUN }, 'received socket event');
        event.emit(RUN, socket);
      });

      socket.on(STOP$1, function (options) {
        _this.log.trace({ client: client, server: _this._server, event: STOP$1 }, 'received socket event');
        event.emit(STOP$1, { options: options, socket: socket });
      });

      socket.on(MAINTENANCE_ENTER$1, function (reason) {
        _this.log.trace({ client: client, server: _this._server, event: MAINTENANCE_ENTER$1 }, 'received socket event');
        event.emit(MAINTENANCE_ENTER$1, { reason: reason, socket: socket });
      });

      socket.on(MAINTENANCE_EXIT$1, function (reason) {
        _this.log.trace({ client: client, server: _this._server, event: MAINTENANCE_EXIT$1 }, 'received socket event');
        event.emit(MAINTENANCE_EXIT$1, { reason: reason, socket: socket });
      });
    });
  });

  // handle local events
  event.on(SCHEDULE$1, function (_ref) {
    var payload = _ref.payload;
    var socket = _ref.socket;

    _this.log.trace({ server: _this._server, event: SCHEDULE$1 }, 'received local event');
    _this.schedule(payload, socket);
  });

  event.on(RUN, function (socket) {
    _this.log.trace({ server: _this._server, event: RUN }, 'received local event');
    _this.run(socket);
  });

  event.on(STOP$1, function (_ref2) {
    var options = _ref2.options;
    var socket = _ref2.socket;

    _this.log.trace({ server: _this._server, event: STOP$1 }, 'received local event');
    _this.stop(options, socket);
  });

  event.on(MAINTENANCE_ENTER$1, function (_ref3) {
    var reason = _ref3.reason;
    var socket = _ref3.socket;

    _this.log.trace({ server: _this._server, event: MAINTENANCE_ENTER$1 }, 'received local event');
    _this.maintenance(true, reason, socket);
  });

  event.on(MAINTENANCE_EXIT$1, function (_ref4) {
    var reason = _ref4.reason;
    var socket = _ref4.socket;

    _this.log.trace({ server: _this._server, event: MAINTENANCE_EXIT$1 }, 'received local event');
    _this.maintenance(false, reason, socket);
  });
}

var ONLINE$1 = RunnerNodeStateEnum.values.ONLINE;
var SCHEDULED = RunnerQueueStateEnum.values.SCHEDULED;
var Enum = factory.utils.Enum;
var STATUS$1 = EVENTS.STATUS;
var SCHEDULE_ERROR$2 = EVENTS.SCHEDULE_ERROR;
var SCHEDULE_ACCEPT$1 = EVENTS.SCHEDULE_ACCEPT;
var RUN$1 = EVENTS.RUN;
var OK$2 = EVENTS.OK;

var source = 'server/schedule';

// gets the next runner in the list and verifies that it is online
function getNextRunner(list, success, fail) {
  var _this = this;

  var idx = arguments.length <= 3 || arguments[3] === undefined ? 0 : arguments[3];

  this.log.trace({ server: this._server, runner: _.get(list, '[' + idx + ']') }, 'checking runner');
  if (idx >= list.length) {
    if (this.state === ONLINE$1) return success(this.info());else return fail(new Error('No runners meet the run requirements'));
  }
  var runner = list[idx];
  idx++;
  if (runner.id === this.id && this.state === ONLINE$1) return success(runner);
  if (!runner.host || !runner.port) return getNextRunner.call(this, list, success, fail, idx);

  return this.emit(runner.host, runner.port, STATUS$1, undefined, defineProperty({}, STATUS$1, function (info) {
    if (_.get(info, 'state') !== ONLINE$1) return getNextRunner.call(_this, list, success, fail, idx);
  }), function () {
    return getNextRunner.call(_this, list, success, fail, idx);
  });
}

// looks through each runner until it finds one that is online and schedules it
function checkRunners(context, queue, list, socket) {
  var _this2 = this;

  var check = new Promise(function (resolve, reject) {
    return getNextRunner.call(_this2, list, resolve, reject);
  });

  this.log.trace({ server: this._server }, 'checking runners for first online');

  return check.then(function (runner) {
    return _this2.queries.updateQueue({
      id: queue.id,
      runner: runner.id,
      state: Enum(SCHEDULED)
    }).then(function () {
      _this2.log.debug({ server: _this2._server, runner: runner.id, queue: queue.id }, 'successfully scheduled queue');
      _this2.emit(runner.host, runner.port, RUN$1, undefined, defineProperty({}, OK$2, function () {
        var target = runner.host + ':' + runner.port;
        _this2.log.trace({ server: _this2._server, target: target }, 'successfully signaled run');
      }), function () {
        _this2.log.warn({ server: _this2._server, target: runner.host + ':' + runner.port }, 'run signal failed');
      });
    }).catch(function (error) {
      _this2.log.debug({ error: error, server: _this2._server, target: runner.host + ':' + runner.port }, 'failed to signal run');
    });
  });
}

// schedule a runner
function setSchedule(action, context, queue, runners, socket) {
  var _this3 = this;

  return new Promise(function (resolve, reject) {
    try {
      return _this3.scheduler(_this3, runners, queue, function (error, list) {
        // check for error
        if (error) {
          _this3.log.error({ error: error, source: source, server: _this3._server, method: 'setSchedule' }, 'failed to set schedule');
          if (socket) socket.emit(SCHEDULE_ERROR$2, 'failed to schedule ' + action + ' because ' + error);
          return reject(error);
        }

        // check for runners, if none, try self
        if (!_.isArray(list) || !list.length) {
          _this3.log.debug({ server: _this3._server, method: 'setSchedule' }, 'no online runners, trying self');
          if (_this3.state !== ONLINE$1) {
            return reject(new Error('No acceptable runners were found'));
          }
          list = [_this3.info()];
        }

        _this3.log.trace({ server: _this3._server, method: 'setSchedule' }, 'a list of runners was obtained');

        // check each runner in the list until one that is ONLINE is found
        checkRunners.call(_this3, context, queue, list, socket);
        return resolve();
      });
    } catch (error) {
      _this3.log.error({ server: _this3._server, method: 'setSchedule', error: error }, 'failed to schedule');
      reject(error);
    }
  });
}

// get a list of online runners
function getOnlineRunner(action, context, queue, socket) {
  var _this4 = this;

  return this.queries.readRunner({ state: Enum(ONLINE$1) }).then(function (runners) {
    _this4.log.debug({ server: _this4._server, source: source }, 'got online runners');
    return setSchedule.call(_this4, action, context, queue, runners, socket);
  }).catch(function (error) {
    _this4.log.error({ error: error, source: source, server: _this4._server, method: 'getOnlineRunner' }, 'failed to create queue');
    if (socket) return socket.emit(SCHEDULE_ERROR$2, 'failed to schedule ' + action);
  });
}

// Creates a queue document immediately after receiving it then tries to schedule it
function createQueue$1(action, context, socket) {
  var _this5 = this;

  return this.queries.createQueue(action, context).then(function (queue) {
    _this5.log.debug({ server: _this5._server, source: source }, 'queue created');
    if (socket) socket.emit(SCHEDULE_ACCEPT$1);
    return getOnlineRunner.call(_this5, action, context, queue, socket);
  }).catch(function (error) {
    _this5.log.error({ error: error, source: source, server: _this5._server, method: 'createQueue' }, 'failed to create queue');
    if (socket) return socket.emit(SCHEDULE_ERROR$2, 'failed to schedule ' + action);
  });
}

// entry point for schedule request
function schedule(payload, socket) {
  if (this.state !== ONLINE$1) {
    this.log.debug({ server: this._server, state: this.state }, 'denied schedule request');
    if (socket) socket.emit(SCHEDULE_ERROR$2, 'runner in state ' + this.state + ' and cannot schedule tasks');
    return Promise.reject('runner in state ' + this.state + ' and cannot schedule tasks');
  }

  var action = payload.action;
  var context = payload.context;

  // validate that the action is valid

  if (!_.has(this.actions, action)) {
    if (socket) socket.emit(SCHEDULE_ERROR$2, action + ' is not a known action');
    this.log.error({ action: action, source: source }, 'invalid action requested');
    return Promise.reject('invalid action requested');
  }
  return createQueue$1.call(this, action, context, socket);
}

var _RunnerNodeStateEnum$$1 = RunnerNodeStateEnum.values;
var ONLINE$2 = _RunnerNodeStateEnum$$1.ONLINE;
var MAINTENANCE$3 = _RunnerNodeStateEnum$$1.MAINTENANCE;
var MAINTENANCE_OK$1 = EVENTS.MAINTENANCE_OK;
var MAINTENANCE_ERROR$1 = EVENTS.MAINTENANCE_ERROR;


function maintenance(enter, reason, socket) {
  if (enter && this.state === ONLINE$2) {
    this.log.info({ server: this._server, reason: reason }, 'entering maintenance');
    this.state = MAINTENANCE$3;

    return this.queries.checkIn().then(function () {
      if (socket) socket.emit(MAINTENANCE_OK$1);
      return true;
    });
  } else if (!enter && this.state === MAINTENANCE$3) {
    this.log.info({ server: this._server, reason: reason }, 'exiting maintenance');
    this.state = ONLINE$2;

    return this.queries.checkIn().then(function () {
      if (socket) socket.emit(MAINTENANCE_OK$1);
      return true;
    });
  } else {
    var msg = 'cannot ' + (enter ? 'enter' : 'exit') + ' maintenance while state is ' + this.state;
    if (socket) socket.emit(MAINTENANCE_ERROR$1, msg);
    return Promise.reject(msg);
  }
}

var ONLINE$3 = RunnerNodeStateEnum.values.ONLINE;
var _RunnerQueueStateEnum = RunnerQueueStateEnum.values;
var SCHEDULED$1 = _RunnerQueueStateEnum.SCHEDULED;
var RUNNING = _RunnerQueueStateEnum.RUNNING;
var FAILED = _RunnerQueueStateEnum.FAILED;
var COMPLETE = _RunnerQueueStateEnum.COMPLETE;
var Enum$1 = factory.utils.Enum;

// marks failed tasks and logs the error

function setTaskFailed(id, error) {
  var _this = this;

  return this.queries.updateQueue({ id: id, state: Enum$1(FAILED) }).then(function () {
    throw error instanceof Error ? error : new Error(error);
  }).catch(function (error) {
    _this.log.error({ server: _this._server, error: error, task: id }, 'task failed');
  });
}

// removes the task on successful completion
function setTaskComplete(id, data) {
  var _this2 = this;

  return this.queries.deleteQueue(id).then(function () {
    _this2.log.debug({ server: _this2._server, task: id, runData: data }, 'task completed successfully');
  }).catch(function (error) {
    _this2.log.error({ server: _this2._server, error: error }, 'failed to set task complete');
  });
}

// returns an error first callback that is called by the action when done
function doneTask(taskId) {
  var _this3 = this;

  return function (err, status, data) {
    delete _this3._running[taskId];
    status = _.includes([COMPLETE, FAILED], _.toUpper(status)) ? status : COMPLETE;
    data = data || status;
    if (err || status === FAILED) return setTaskFailed.call(_this3, taskId, err || data);
    return setTaskComplete.call(_this3, taskId, data);
  };
}

// runs the task/action
function runTask(task) {
  var _this4 = this;

  var id = task.id;
  var action = task.action;
  var context = task.context;

  if (!_.has(this.actions, action)) return this.log.error({ server: this._server, action: action }, 'action is not valid');

  return this.queries.updateQueue({ id: id, state: Enum$1(RUNNING) }).then(function () {
    _this4._running[id] = { action: action, started: new Date() };
    var taskRun = _this4.actions[action](_this4, context, doneTask.call(_this4, id));
    if (_this4.isPromise(taskRun)) {
      return taskRun.then(function () {
        return true;
      }).catch(function (error) {
        throw error instanceof Error ? error : new Error(error);
      });
    }
    return taskRun;
  }).catch(function (error) {
    _this4.log.error({ server: _this4._server, action: action, error: error }, 'failed to update the queue');
  });
}

// gets the tasks assigned to this runner
function getAssigned() {
  var _this5 = this;

  return this.queries.readQueue({ runner: this.id, state: Enum$1(SCHEDULED$1) }).then(function (tasks) {
    _this5.log.trace({ server: _this5._server }, 'acquired tasks');
    _.forEach(tasks, function (task) {
      return runTask.call(_this5, task);
    });
  }).catch(function (error) {
    _this5.log.debug({ server: _this5._server, error: error }, 'failed to get assigned tasks');
  });
}

// checks for assigned tasks and attempts to run them
function run(socket) {
  if (this.state !== ONLINE$3) {
    this.log.debug({ server: this._server, state: this.state }, 'denied run request');
    if (socket) socket.emit(SCHEDULE_ERROR, 'runner in state ' + this.state + ' and cannot run tasks');
    return Promise.reject('runner in state ' + this.state + ' and cannot run tasks');
  }

  this.log.trace({ server: this._server }, 'checking queue');
  if (socket) socket.emit(OK);
  return getAssigned.call(this);
}

var OK$3 = EVENTS.OK;
var OFFLINE$2 = RunnerNodeStateEnum.values.OFFLINE;


function forceStop(socket) {
  // send an ok response to cleanly exit
  // but also set a timeout for 5 seconds to ensure the process exits
  if (socket) socket.emit(OK$3);
  if (socket) socket.on(OK$3, function () {
    return process.exit();
  });
  setTimeout(function () {
    return process.exit();
  }, 5000);
}

function processStop(socket, options) {
  var _this = this;

  var count = arguments.length <= 2 || arguments[2] === undefined ? 0 : arguments[2];

  // check for force option
  if (options.force) return forceStop(socket);
  if (_.keys(this.running).length && count <= options.maxWait) {
    return setTimeout(function () {
      return processStop.call(_this, socket, options, count++);
    }, 1000);
  }
  return forceStop(socket);
}

function stop() {
  var _this2 = this;

  var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
  var socket = arguments[1];

  this.logInfo('Server stop requested');
  options.maxWait = isNaN(options.maxWait) ? 30 : Math.round(Number(options.maxWait));

  // set the runner offline so that it will not be scheduled any new tasks
  this.state = OFFLINE$2;

  // check in to update the database
  return this.queries.checkIn().then(function () {
    return processStop.call(_this2, socket, options);
  }).catch(function () {
    return processStop.call(_this2, socket, options);
  });
}

var AUTHENTICATE$1 = EVENTS.AUTHENTICATE;
var AUTHENTICATED$1 = EVENTS.AUTHENTICATED;
var AUTHENTICATION_ERROR$1 = EVENTS.AUTHENTICATION_ERROR;
var TOKEN$1 = EVENTS.TOKEN;
var CONNECT_ERROR = EVENTS.CONNECT_ERROR;
var CONNECT_TIMEOUT = EVENTS.CONNECT_TIMEOUT;


function emit(host, port, event, payload) {
  var listeners = arguments.length <= 4 || arguments[4] === undefined ? {} : arguments[4];

  var _this = this;

  var errorHandler = arguments.length <= 5 || arguments[5] === undefined ? function () {
    return true;
  } : arguments[5];
  var timeout = arguments[6];

  this.log.debug({ emitter: this._server, target: host + ':' + port, event: event }, 'emitting event');
  timeout = timeout || this._socketTimeout;

  // check if emitting to self, if so use local even emitter
  if (host === this._host && port === this._port) return this._emitter.emit(event, payload);

  // check if a socket already exists
  var socket = _.get(this._sockets, host + ':' + port);

  // if it does, emit the event
  if (socket) {
    this.log.trace({ emitter: this._server }, 'socket found');
    _.forEach(listeners, function (handler, listener) {
      if (!_.has(socket, 'listeners["' + listener + '"]')) {
        _this.log.trace({ emitter: _this._server, listener: listener }, 'adding new listener');
        _.set(_this._sockets, '["' + host + ':' + port + '"].listeners["' + listener + '"]', handler);
        socket.socket.on(listener, handler);
      }
    });
    return socket.socket.emit(event, payload);
  }

  this.log.trace({ emitter: this._server }, 'creating a new socket');

  // if it does not, initiate a connection
  socket = SocketClient('http' + (this._secureSocket ? 's' : '') + '://' + host + ':' + port, { timeout: timeout });
  _.set(this._sockets, '["' + host + ':' + port + '"]', { socket: socket, listeners: {} });

  // listen for authentication events
  socket.on(AUTHENTICATE$1, function () {
    _this.log.trace({ emitter: _this._server }, 'got authentication request, emitting token');
    socket.emit(TOKEN$1, _this._token);
  });

  socket.on(AUTHENTICATED$1, function () {
    _.forEach(listeners, function (handler, listener) {
      _this.log.trace({ emitter: _this._server, listener: listener }, 'adding new listener');
      _.set(_this._sockets, '["' + host + ':' + port + '"].listeners["' + listener + '"]', handler);
      socket.on(listener, handler);
    });
    socket.emit(event, payload);
  });

  // authentication error
  socket.on(AUTHENTICATION_ERROR$1, function (error) {
    _this.log.trace({ emitter: _this._server, error: error }, 'authentication error');
    _this.disconnectSocket(host, port);
    return errorHandler(error);
  });

  // listen for errors
  socket.on(CONNECT_ERROR, function () {
    var s = _.get(_this._sockets, host + ':' + port);
    if (s) {
      _this.disconnectSocket(host, port);
      return errorHandler(new Error('socket.io connection error'));
    }
  });
  socket.on(CONNECT_TIMEOUT, function () {
    var s = _.get(_this._sockets, host + ':' + port);
    if (s) {
      _this.disconnectSocket(host, port);
      return errorHandler(new Error('socket.io connection timeout error'));
    }
  });
}

var _RunnerNodeStateEnum$ = RunnerNodeStateEnum.values;
var ONLINE = _RunnerNodeStateEnum$.ONLINE;
var MAINTENANCE$2 = _RunnerNodeStateEnum$.MAINTENANCE;
var DISCONNECT = EVENTS.DISCONNECT;


var YellowJacketServer = function () {
  function YellowJacketServer(backend) {
    var _this = this;

    var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];
    classCallCheck(this, YellowJacketServer);
    var host = options.host;
    var port = options.port;
    var token = options.token;
    var socket = options.socket;

    socket = socket || { secure: false, timeout: 2000 };
    // token = token || { secret: SIGNING_KEY, algorithm: SIGNING_ALG }

    this._logLevel = _.get(LOG_LEVELS, options.loglevel) || LOG_LEVELS.info;
    this.log = backend.logger || basicLogger.call(this);

    if (!backend) {
      this.log.fatal({}, 'no backend provided');
      throw new Error('No backend provided');
    }
    if (!_.isObject(backend.actions)) {
      this.log.fatal({}, 'invalid actions');
      throw new Error('Invalid actions');
    }
    if (!_.isString(host)) {
      this.log.fatal({}, 'host is invalid or not specified');
      throw new Error('host is invalid or not specified');
    }

    // store props
    this.backend = backend;
    this.actions = backend.actions;
    this.options = options;
    this.scheduler = backend.scheduler || this.defaultScheduler;
    this.queries = queries(this);
    this.lib = backend.lib;
    this._host = host;
    this._port = port || 8080;
    this._server = this._host + ':' + this._port;
    this._emitter = new Events.EventEmitter();
    this._sockets = {};
    this._socketTimeout = socket.timeout || 2000;
    this._secureSocket = Boolean(socket.secure);
    this._running = {};

    // token settings and creation
    this._tokenStore = tokenStore(this._host, this._port, token);
    this._token = this._tokenStore.token;

    // get the global settings
    return this.queries.getSettings().then(function (settings) {
      _this._appName = settings.appName;
      _this._checkinFrequency = settings.checkinFrequency;
      _this._offlineAfterPolls = settings.offlineAfterPolls;
      _this._offlineAfter = _this._checkinFrequency * _this._offlineAfterPolls;

      _this.log.info({ server: _this._server }, 'starting server');

      // get self
      return _this.queries.getSelf().then(function (self) {
        _this.id = self.id;
        _this.state = self.state === MAINTENANCE$2 ? MAINTENANCE$2 : ONLINE;

        // check in
        return _this.queries.checkIn(true).then(function () {
          // set up socket.io server
          _this._app = http.createServer(function (req, res) {
            res.writeHead(200);
            res.end('' + _this._server);
          });
          _this._app.listen(port);
          _this._io = new SocketServer(_this._app);

          // if the state is online start the listeners
          if (_this.state === ONLINE) _this.startListeners();
        });
      });
    }).catch(function (error) {
      _this.log.fatal({ server: _this._server, error: error }, 'the server failed to start');
      throw error;
    });
  }

  createClass(YellowJacketServer, [{
    key: 'isPromise',
    value: function isPromise(obj) {
      return _.isFunction(_.get(obj, 'then')) && _.isFunction(_.get(obj, 'catch'));
    }
  }, {
    key: 'startListeners',
    value: function startListeners$$() {
      startListeners.call(this);
    }
  }, {
    key: 'emit',
    value: function emit$$(host, port, event, payload, listener, cb, timeout) {
      return emit.call(this, host, port, event, payload, listener, cb, timeout);
    }
  }, {
    key: 'schedule',
    value: function schedule$$(payload, socket) {
      return schedule.call(this, payload, socket);
    }
  }, {
    key: 'run',
    value: function run$$(socket) {
      return run.call(this, socket);
    }
  }, {
    key: 'stop',
    value: function stop$$(options, socket) {
      return stop.call(this, options, socket);
    }
  }, {
    key: 'maintenance',
    value: function maintenance$$(enter, socket) {
      return maintenance.call(this, enter, socket);
    }
  }, {
    key: 'info',
    value: function info() {
      return {
        id: this.id,
        host: this._host,
        port: this._port,
        state: this.state,
        running: _.keys(this._running).length
      };
    }
  }, {
    key: 'disconnectSocket',
    value: function disconnectSocket(host, port) {
      this.log.debug({ server: this._server, target: host + ':' + port }, 'disconnecting socket');
      this.emit(host, port, DISCONNECT, undefined, OK, function () {
        return true;
      }, 500);
      var s = _.get(this._sockets, '["' + host + ':' + port + '"].socket');
      if (s) {
        this._sockets[host + ':' + port].socket.disconnect(0);
        delete this._sockets[host + ':' + port];
      }
    }
  }, {
    key: 'defaultScheduler',
    value: function defaultScheduler(backend, runners, queue, done) {
      return done(null, [this.info()]);
    }
  }, {
    key: 'verify',
    value: function verify(token) {
      return this._tokenStore.verify(token);
    }
  }]);
  return YellowJacketServer;
}();

function YellowJacketServer$1 (backend, options) {
  return new YellowJacketServer(backend, options);
}

var DISCONNECT$1 = EVENTS.DISCONNECT;
var OK$4 = EVENTS.OK;


var YellowjacketClient = function () {
  function YellowjacketClient(backend) {
    var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];
    classCallCheck(this, YellowjacketClient);
    var socket = options.socket;
    var token = options.token;
    var host = options.host;
    var port = options.port;


    this._logLevel = _.get(LOG_LEVELS, options.loglevel) || LOG_LEVELS.info;
    this.log = backend.logger || basicLogger.call(this);

    socket = socket || {};
    this._backend = backend;
    this._emitter = new Events.EventEmitter();
    this._host = host || 'localhost';
    this._port = port || 1;
    this._server = this._host + ':' + this._port;
    this._tokenStore = tokenStore(this._host, this._port, token);
    this._token = this._tokenStore.token;
    this._sockets = {};
    this._socketTimeout = socket.timeout || 2000;
    this._secureSocket = Boolean(socket.secure);
  }

  createClass(YellowjacketClient, [{
    key: 'emit',
    value: function emit$$(host, port, event, payload, listener, cb, timeout) {
      return emit.call(this, host, port, event, payload, listener, cb, timeout);
    }
  }, {
    key: 'disconnectSocket',
    value: function disconnectSocket(host, port) {
      this.log.debug({ server: this._server, target: host + ':' + port }, 'disconnecting socket');
      this.emit(host, port, DISCONNECT$1, undefined, OK$4, function () {
        return true;
      }, 500);
      var s = _.get(this._sockets, '["' + host + ':' + port + '"].socket');
      if (s) {
        this._sockets[host + ':' + port].socket.disconnect(0);
        delete this._sockets[host + ':' + port];
      }
    }
  }]);
  return YellowjacketClient;
}();

function YellowjacketClient$1 (backend) {
  var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

  return new YellowjacketClient(backend, options);
}

var OK$1 = EVENTS.OK;
var STOP = EVENTS.STOP;
var SCHEDULE = EVENTS.SCHEDULE;
var SCHEDULE_ACCEPT = EVENTS.SCHEDULE_ACCEPT;
var SCHEDULE_ERROR$1 = EVENTS.SCHEDULE_ERROR;
var MAINTENANCE_ENTER = EVENTS.MAINTENANCE_ENTER;
var MAINTENANCE_EXIT = EVENTS.MAINTENANCE_EXIT;
var MAINTENANCE_ERROR = EVENTS.MAINTENANCE_ERROR;
var MAINTENANCE_OK = EVENTS.MAINTENANCE_OK;


function listRunner(args) {
  return this.queries.readRunner(args);
}

function addRunner(args) {
  if (!_.isObject(args)) throw new Error('No options provided');
  var host = args.host;
  var port = args.port;
  var zone = args.zone;
  var metadata = args.metadata;

  var payload = _.omitBy({ host: host, port: port, zone: zone, metadata: metadata }, function (v) {
    return v === undefined;
  });
  return this.queries.createRunner(payload);
}

function removeRunner(args) {
  if (!_.get(args, 'id')) throw new Error('ID required to remove');
  var id = args.id;

  return this.queries.deleteRunner(id);
}

function updateRunner$1(args) {
  if (!_.isObject(args)) throw new Error('No options provided');
  if (args.state) args.state = factory.utils.Enum(args.state);
  return this.queries.updateRunner(args);
}

function startRunner(options) {
  return YellowJacketServer$1(this, options);
}

function scheduleRunner(_ref) {
  var host = _ref.host;
  var port = _ref.port;
  var action = _ref.action;
  var context = _ref.context;
  var _ref$loglevel = _ref.loglevel;
  var loglevel = _ref$loglevel === undefined ? LOG_LEVELS.info : _ref$loglevel;

  var client = YellowjacketClient$1(this, { loglevel: loglevel });

  return new Promise(function (resolve, reject) {
    var _client$emit;

    client.emit(host, port, SCHEDULE, { action: action, context: context }, (_client$emit = {}, defineProperty(_client$emit, SCHEDULE_ACCEPT, function () {
      resolve('Schedule request accepted');
    }), defineProperty(_client$emit, SCHEDULE_ERROR$1, function (error) {
      reject(error);
    }), _client$emit), function (error) {
      reject(error);
    });
  });
}

function maintenanceRunner(_ref3) {
  var host = _ref3.host;
  var port = _ref3.port;
  var exit = _ref3.exit;
  var reason = _ref3.reason;
  var _ref3$loglevel = _ref3.loglevel;
  var loglevel = _ref3$loglevel === undefined ? LOG_LEVELS.info : _ref3$loglevel;

  var client = YellowjacketClient$1(this, { loglevel: loglevel });

  var EVT = exit ? MAINTENANCE_EXIT : MAINTENANCE_ENTER;

  return new Promise(function (resolve, reject) {
    var _client$emit3;

    client.emit(host, port, EVT, reason, (_client$emit3 = {}, defineProperty(_client$emit3, MAINTENANCE_OK, function () {
      resolve((exit ? 'exit' : 'enter') + 'ed maintenance successfully');
    }), defineProperty(_client$emit3, MAINTENANCE_ERROR, function (error) {
      reject(error);
    }), _client$emit3), function (error) {
      reject(error);
    });
  });
}

function installStore(options) {
  var data = options.data;

  // if the data is a file path, get the data from the file

  data = _.isString(data) ? JSON.parse(fs.readFileSync(path.resolve(data))) : data;
  return this.initAllStores(true, data);
}

function cmd(command) {
  var _this = this;

  return new Promise(function (resolve, reject) {
    if (!_.isObject(command)) return reject(Error('Invalid command object'));

    var target = command.target;
    var action = command.action;
    var options = command.options;

    action = action || null;

    if (!target) return reject(Error('No target specified'));

    switch (target) {

      case 'runner':
        switch (action) {
          case 'list':
            return resolve(listRunner.call(_this, options));
          case 'add':
            return resolve(addRunner.call(_this, options));
          case 'remove':
            return resolve(removeRunner.call(_this, options));
          case 'update':
            return resolve(updateRunner$1.call(_this, options));
          case 'maintenance':
            return resolve(maintenanceRunner.call(_this, options));
          case 'start':
            return resolve(startRunner.call(_this, options));
          case 'schedule':
            return resolve(scheduleRunner.call(_this, options));
          default:
            return reject(Error('Invalid action'));
        }

      case 'zone':

      case 'queue':

      case 'settings':

      case 'store':
        switch (action) {
          case 'install':
            return resolve(installStore.call(_this, options));
          default:
            return reject(Error('Invalid action'));
        }
      default:
        return reject(Error('Invalid targert'));
    }
  });
}

var config = {
  options: {
    error: function error(err) {
      console.error('ERROR:', err.message || err);
      process.exit();
    }
  },
  commands: {
    store: {
      commands: {
        install: {
          options: {
            data: { type: 'String' }
          }
        }
      }
    },
    runner: {
      commands: {
        add: {
          options: {
            host: { type: 'String' },
            port: { type: 'Int' }
          }
        },
        remove: {
          options: {
            id: { type: 'String' }
          }
        },
        update: {
          options: {
            id: { type: 'String' },
            host: { type: 'String' },
            port: { type: 'Int' },
            zone: { type: 'String' },
            state: { type: 'String' }
          }
        },
        start: {
          options: {
            host: { type: 'String' },
            port: { type: 'Int' },
            loglevel: { type: 'String' },
            logfile: { type: 'String' }
          }
        },
        stop: {
          options: {
            host: { type: 'String' },
            port: { type: 'Int' },
            force: { type: 'Boolean' }
          }
        },
        maintenance: {
          options: {
            host: { type: 'String' },
            port: { type: 'Int' },
            enter: true,
            exit: true,
            reason: { type: 'String' }
          }
        },
        list: {
          options: {
            id: { type: 'String' },
            host: { type: 'String' },
            port: { type: 'Int' },
            state: { type: 'String' },
            zone: { type: 'String' }
          }
        },
        status: {
          options: {
            id: { type: 'String' },
            host: { type: 'String' },
            port: { type: 'Int' }
          }
        },
        schedule: {
          options: {
            id: { type: 'String' },
            host: { type: 'String' },
            port: { type: 'Int' },
            action: { type: 'String' },
            context: { type: 'JSON' }
          }
        }
      },
      options: {
        help: true
      }
    },
    zone: {
      options: {
        list: true
      }
    },
    queue: {
      options: {
        list: true
      }
    },
    settings: {
      options: {
        list: true
      }
    }
  }
};

function getOptions () {
  var customConfig = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
  var parser = arguments[1];

  var options = {};

  // merge a custom config in with the standard one so that the cli can be extended
  var opts = NestedOpts(_.merge({}, customConfig, config)).options;

  if (!opts.valid) throw Error('invalid options');

  // allow a custom parser function to return the options object
  if (_.isFunction(parser)) return parser(opts);

  options.target = opts.command;
  if (opts.subcommand) {
    options.action = opts.subcommand.command;
    options.options = opts.subcommand.options;
  } else if (opts.options) {
    options.options = opts.options;
  }

  return options;
}

function cli(config, parser) {
  var options = getOptions(config, parser);
  this.cmd(options).then(function (result) {
    try {
      console.log(JSON.stringify(result, null, '  '));
    } catch (err) {
      console.log(result);
    }
    process.exit();
  }).catch(function (error) {
    console.error(error.message);
    process.exit();
  });
}

var YellowjacketRethinkDBBackend = function (_GraphQLFactoryRethin) {
  inherits(YellowjacketRethinkDBBackend, _GraphQLFactoryRethin);

  function YellowjacketRethinkDBBackend(namespace, graphql, r) {
    var config = arguments.length <= 3 || arguments[3] === undefined ? {} : arguments[3];
    var connection = arguments[4];
    classCallCheck(this, YellowjacketRethinkDBBackend);

    config = mergeConfig(config);

    var _this = possibleConstructorReturn(this, (YellowjacketRethinkDBBackend.__proto__ || Object.getPrototypeOf(YellowjacketRethinkDBBackend)).call(this, namespace, graphql, factory, r, config, connection));

    _this.type = 'YellowjacketRethinkDBBackend';
    _this.actions = {};

    // add actions and scheduler and logger
    var _config = config;
    var actions = _config.actions;
    var scheduler = _config.scheduler;
    var logger = _config.logger;

    _this.addActions(actions);

    if (_.isFunction(scheduler)) _this.scheduler = scheduler;
    _this.logger = logger;

    // add custom functions
    _this.addFunctions(functions);

    // add queries
    _this.addQueries(queries(_this));

    // add cmd method
    _this.cmd = cmd.bind(_this);

    // add the cli method
    _this.cli = cli.bind(_this);

    return _this;
  }

  createClass(YellowjacketRethinkDBBackend, [{
    key: 'addActions',
    value: function addActions(actions) {
      if (!_.isFunction(actions) && !_.isObject(actions)) return;
      // if actions is a function it takes the backend as its argument
      // otherwise merge with the existing actions
      actions = _.isFunction(actions) ? actions(this) : actions;
      this.actions = _.merge({}, this.actions, actions);
    }
  }]);
  return YellowjacketRethinkDBBackend;
}(graphqlFactoryBackend.GraphQLFactoryRethinkDBBackend);

// helper function to instantiate a new backend
function rethinkdb (namespace, graphql, r, config, connection) {
  return new YellowjacketRethinkDBBackend(namespace, graphql, r, config, connection);
}

var index = {
  rethinkdb: rethinkdb,
  YellowjacketRethinkDBBackend: YellowjacketRethinkDBBackend
};

exports.rethinkdb = rethinkdb;
exports.YellowjacketRethinkDBBackend = YellowjacketRethinkDBBackend;
exports['default'] = index;