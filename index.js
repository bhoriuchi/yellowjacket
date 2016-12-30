'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var _ = _interopDefault(require('lodash'));
var factory = _interopDefault(require('graphql-factory'));
var graphqlFactoryBackend = require('graphql-factory-backend');
var obj2arg = _interopDefault(require('graphql-obj2arg'));
var os = _interopDefault(require('os'));
var Events = _interopDefault(require('events'));
var http = _interopDefault(require('http'));
var SocketServer = _interopDefault(require('socket.io'));
var fs = _interopDefault(require('fs'));
var path = _interopDefault(require('path'));
var jwt = _interopDefault(require('jsonwebtoken'));
var chalk = require('chalk');
var socketioJwt = _interopDefault(require('socketio-jwt'));
var hat = _interopDefault(require('hat'));
var SocketClient = _interopDefault(require('socket.io-client'));
var NestedOpts = _interopDefault(require('nested-opts'));
var FactoryTypePlugin = _interopDefault(require('graphql-factory-types'));

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


var checkinRunnerNode = function (backend) {
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
};

var createRunnerSettings = function (backend) {
  return function (source, args, context, info) {
    var q = backend.q;


    return q.type('RunnerSettings').count().gt(0).branch(q.error('a settings document has already been created'), q.type('RunnerSettings').insert(args).value()).run();
  };
};

var deleteRunnerSettings = function (backend) {
  return function (source, args, context, info) {
    var q = backend.q;


    return q.type('RunnerSettings').delete().do(function () {
      return true;
    }).run();
  };
};

var readRunnerSettings = function (backend) {
  return function (source, args, context, info) {
    var q = backend.q;


    return q.type('RunnerSettings').count().eq(0).branch(q.error('a settings document has not been created yet'), q.type('RunnerSettings').nth(0).value()).run();
  };
};

var updateRunnerSettings = function (backend) {
  return function (source, args, context, info) {
    var q = backend.q;


    return q.type('RunnerSettings').count().eq(0).branch(q.error('a settings document has not been created yet'), q.type('RunnerSettings').nth(0).update(args).do(function () {
      return q.type('RunnerSettings').nth(0).value();
    }).value()).run();
  };
};

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
  CONNECT: 'connect',
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
  STOPPING: 'stopping',
  STOPPING_ACK: 'stopping.acknowledge',
  STOP_ERROR: 'stop.error',
  RESTART: 'restart',
  RESTART_ERROR: 'restart.error',
  AUTHENTICATE: 'authenticate',
  TOKEN: 'token',
  TOKEN_EXPIRED_ERROR: 'token.expired.error',
  AUTHENTICATION_ERROR: 'authentication.error',
  AUTHENTICATED: 'authenticated',
  MAINTENANCE_ENTER: 'maintenance.enter',
  MAINTENANCE_EXIT: 'maintenance.exit',
  MAINTENANCE_ERROR: 'maintenance.error',
  MAINTENANCE_OK: 'maintenance.ok',
  RESULT: 'result',
  UNAUTHORIZED: 'unauthorized'
};

// defaults for JWT
var SIGNING_KEY = 'twothingsareinfinitetheuniverseandhumanstupidityandimnotsureabouttheuniverse';
var SIGNING_ALG = 'none';
var TOKEN_EXPIRES_IN = 30;

var CONST = {
  ONE_SECOND_IN_MS: ONE_SECOND_IN_MS,
  LOG_LEVELS: LOG_LEVELS,
  EVENTS: EVENTS,
  SIGNING_KEY: SIGNING_KEY,
  SIGNING_ALG: SIGNING_ALG
};

function checkIn(first) {
  var _this = this;

  var msg = first ? 'first check in for ' + this._server : 'checking in ' + this._server;
  this.log.trace({ server: this._server, state: this.state }, msg);

  // run the checkIn on an interval
  setTimeout(function () {
    return checkIn.call(_this);
  }, this._checkinFrequency * ONE_SECOND_IN_MS);

  return this.lib.Yellowjacket('\n  mutation Mutation {\n    checkinRunnerNode (\n      id: "' + this.id + '",\n      state: ' + this.state + ',\n      offlineAfter: ' + this._offlineAfter + '\n    )\n  }').then(function (result) {
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
  return this.lib.Yellowjacket('mutation Mutation \n    {\n      createRunnerQueue (\n        action: "' + action + '",\n        context: ' + obj2arg(context) + ',\n        state: ' + UNSCHEDULED + '\n      ) {\n        id,\n        action,\n        context\n      }  \n    }').then(function (result) {
    var queue = _.get(result, 'data.createRunnerQueue');
    if (result.errors) throw new Error(result.errors);
    if (!queue) throw new Error('Could not create queue');
    return queue;
  });
}

function createRunner(args) {
  return this.lib.Yellowjacket('mutation Mutation\n  {\n    createRunnerNode (' + obj2arg(args, { noOuterBraces: true }) + ')\n    {\n      id,\n      host,\n      port,\n      state,\n      zone { id, name },\n      metadata\n    }\n  }').then(function (result) {
    var runner = _.get(result, 'data.createRunnerNode');
    if (result.errors) throw result.errors;
    if (!runner) throw new Error('runner not created');
    return runner;
  });
}

function deleteQueue(id) {
  return this.lib.Yellowjacket('mutation Mutation\n  {\n    deleteRunnerQueue (id: "' + id + '")\n  }').then(function (result) {
    var queue = _.get(result, 'data.deleteRunnerQueue');
    if (result.errors) throw new Error(result.errors);
    if (!queue) throw new Error('queue not deleted');
    return queue;
  });
}

function deleteRunner(id) {
  return this.lib.Yellowjacket('mutation Mutation\n  {\n    deleteRunnerNode (id: "' + id + '")\n  }').then(function (result) {
    var runner = _.get(result, 'data.deleteRunnerNode');
    if (result.errors) throw new Error(result.errors);
    if (!runner) throw new Error('runner not deleted');
    return runner;
  });
}

function getSelf() {
  var _this = this;

  this.log.trace({ server: this._server }, 'getting self');

  return this.lib.Yellowjacket('\n    {\n      readRunnerNode (\n        host: "' + this._host + '",\n        port: ' + this._port + '\n      )\n      {\n        id,\n        state\n      }\n    }').then(function (result) {
    var runner = _.get(result, 'data.readRunnerNode[0]');
    if (result.errors) throw new Error(result.errors);
    if (!runner) throw new Error('Runner with host:port ' + _this._server + ' must be added first');
    return runner;
  });
}

function getSettings() {

  this.log.trace({ server: this._server }, 'getting global settings');

  return this.lib.Yellowjacket('\n    {\n      readRunnerSettings {\n        appName,\n        checkinFrequency,\n        offlineAfterPolls\n      }\n    }').then(function (result) {
    var settings = _.get(result, 'data.readRunnerSettings');
    if (result.errors) throw new Error(result.errors);
    if (!settings) throw new Error('No settings document was found');
    return settings;
  });
}

function readQueue(args) {
  return this.lib.Yellowjacket('\n  {\n    readRunnerQueue (' + obj2arg(args, { noOuterBraces: true }) + ')\n    {\n      id,\n      created,\n      updated,\n      runner,\n      state,\n      action,\n      context\n    }\n  }').then(function (result) {
    var tasks = _.get(result, 'data.readRunnerQueue');
    if (result.errors) throw new Error(result.errors);
    if (!tasks) throw new Error('No tasks');
    return tasks;
  });
}

function readRunner(args) {

  var filter = _.isObject(args) ? '(' + obj2arg(args, { noOuterBraces: true }) + ')' : '';

  return this.lib.Yellowjacket('\n  {\n    readRunnerNode ' + filter + '\n    {\n      id,\n      host,\n      port,\n      zone { id, name, description, metadata },\n      state,\n      metadata\n    }\n  }').then(function (result) {
    var runners = _.get(result, 'data.readRunnerNode');
    if (result.errors) throw new Error(result.errors);
    if (!runners) throw new Error('No runners');
    return runners;
  });
}

function updateQueue(args) {
  return this.lib.Yellowjacket('mutation Mutation\n  {\n    updateRunnerQueue (' + obj2arg(args, { noOuterBraces: true }) + ')\n    {\n      id,\n      runner,\n      state,\n      action,\n      context\n    }\n  }').then(function (result) {
    var queue = _.get(result, 'data.updateRunnerQueue');
    if (result.errors) throw new Error(result.errors);
    if (!queue) throw new Error('queue not updated');
    return queue;
  });
}

function updateRunner(args) {
  return this.lib.Yellowjacket('mutation Mutation\n  {\n    updateRunnerNode (' + obj2arg(args, { noOuterBraces: true }) + ')\n    {\n      id,\n      host,\n      port,\n      zone { id, name, description, metadata },\n      state,\n      metadata\n    }\n  }').then(function (result) {
    var runner = _.get(result, 'data.updateRunnerNode');
    if (result.errors) throw new Error(result.errors);
    if (!runner) throw new Error('runner not updated');
    return runner;
  });
}

var queries = function (backend) {
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
};

var OFFLINE$1 = RunnerNodeStateEnum.values.OFFLINE;


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
    schema: 'Yellowjacket',
    collection: 'runner_node',
    mutation: {
      create: {
        before: function before(fnArgs, backend, done) {
          var args = fnArgs.args;

          if (!args.host) return done(new Error('Missing required field host'));
          if (!args.port) return done(new Error('Missing required field port'));

          delete args.id;
          delete args.checkin;

          args.state = OFFLINE$1;
          return done();
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
    schema: 'Yellowjacket',
    collection: 'runner_queue',
    mutation: {
      create: {
        before: function before(fnArgs, backend, done) {
          var args = fnArgs.args;

          return backend.now(function (err, now) {
            if (err) return done(err);
            args.create = now;
            args.updated = now;
          });
        }
      },
      update: {
        before: function before(fnArgs, backend, done) {
          var args = fnArgs.args;

          return backend.now(function (err, now) {
            if (err) return done(err);
            args.updated = now;
          });
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
    queueCheckFrequency: {
      description: 'Time in seconds between automatic queue checks',
      type: 'Int'
    },
    offlineAfterPolls: {
      description: 'Number of checkins that can be missed before marking the runner offline',
      type: 'Int'
    }
  },
  _backend: {
    schema: 'Yellowjacket',
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
    schema: 'Yellowjacket',
    collection: 'runner_zone'
  }
};

var typeDefinitions = {
  RunnerNode: RunnerNode,
  RunnerNodeStateEnum: RunnerNodeStateEnum,
  RunnerQueue: RunnerQueue,
  RunnerQueueStateEnum: RunnerQueueStateEnum,
  RunnerSettings: RunnerSettings,
  RunnerZone: RunnerZone
};

var installData = {
  RunnerSettings: [{
    appName: 'YELLOWJACKET',
    checkinFrequency: 30,
    queueCheckFrequency: 30,
    offlineAfterPolls: 1
  }]
};

function logify(level, args) {
  if (_.isObject(_.get(args, '[0]'))) {
    args[0].level = level;
  } else {
    args = [{ level: level }].concat(args);
  }
  return args;
}

// basic logging to the console
var basicLogger = function () {
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
};

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
    this.tokenOptions.expiresIn = this.tokenOptions.expiresIn || TOKEN_EXPIRES_IN;
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
      return this.token;
    }
  }, {
    key: 'renewIfExpired',
    value: function renewIfExpired() {
      var verify = this.verify(this.token);
      if (_.has(verify, 'error') && verify.expired) this.renew();
      return this.token;
    }
  }, {
    key: 'verify',
    value: function verify(token) {
      try {
        return jwt.verify(token, this._signingKey);
      } catch (error) {
        return { error: error, expired: _.get(error, 'name') === 'TokenExpiredError' };
      }
    }
  }, {
    key: 'secret',
    get: function get() {
      return this._signingKey;
    }
  }]);
  return YellowjacketTokenStore;
}();

var tokenStore = function (config) {
  return new YellowjacketTokenStore(config);
};

var CONNECTION = EVENTS.CONNECTION;
var AUTHENTICATED = EVENTS.AUTHENTICATED;
var STATUS = EVENTS.STATUS;
var SCHEDULE$1 = EVENTS.SCHEDULE;
var RUN$1 = EVENTS.RUN;
var STOP$1 = EVENTS.STOP;
var MAINTENANCE_ENTER$1 = EVENTS.MAINTENANCE_ENTER;
var MAINTENANCE_EXIT$1 = EVENTS.MAINTENANCE_EXIT;


var LOCAL_REQUEST = 'LOCAL_REQUEST';



function addListeners(socket) {
  var _this = this;

  var event = this._emitter;
  var client = _.get(socket, 'conn.remoteAddress', 'unknown');
  this.log.debug({ server: this._server, client: client }, 'socket.io connection made');

  // register post-authentication events
  _.forEach(_.get(this, 'backend.events.socket'), function (evt, evtName) {
    if (_.isFunction(evt.handler)) {
      _this.log.trace({ eventRegistered: evtName }, 'registering post-auth socket event');
      socket.on(evtName, function (_ref) {
        var payload = _ref.payload,
            requestId = _ref.requestId;

        evt.handler.call(_this, { requestId: requestId, payload: payload, socket: socket });
      });
    }
  });

  socket.on(STATUS, function (_ref2) {
    var requestId = _ref2.requestId;

    _this.log.trace({ client: client, server: _this._server, event: STATUS }, 'received socket event');
    socket.emit(STATUS + '.' + requestId, _this.info());
  });

  socket.on(SCHEDULE$1, function (_ref3) {
    var payload = _ref3.payload,
        requestId = _ref3.requestId;

    _this.log.trace({ client: client, server: _this._server, event: SCHEDULE$1 }, 'received socket event');
    event.emit(SCHEDULE$1, { requestId: requestId, payload: payload, socket: socket });
  });

  socket.on(RUN$1, function (_ref4) {
    var requestId = _ref4.requestId;

    _this.log.trace({ client: client, server: _this._server, event: RUN$1 }, 'received socket event');
    event.emit(RUN$1, { requestId: requestId, socket: socket });
  });

  socket.on(STOP$1, function (_ref5) {
    var requestId = _ref5.requestId,
        payload = _ref5.payload;

    options = options || {};
    _this.log.trace({ client: client, server: _this._server, event: STOP$1 }, 'received socket event');
    event.emit(STOP$1, { requestId: requestId, payload: payload, socket: socket });
  });

  socket.on(MAINTENANCE_ENTER$1, function (_ref6) {
    var requestId = _ref6.requestId,
        payload = _ref6.payload;

    _this.log.trace({ client: client, server: _this._server, event: MAINTENANCE_ENTER$1 }, 'received socket event');
    event.emit(MAINTENANCE_ENTER$1, { requestId: requestId, payload: payload, socket: socket });
  });

  socket.on(MAINTENANCE_EXIT$1, function (_ref7) {
    var requestId = _ref7.requestId,
        payload = _ref7.payload;

    _this.log.trace({ client: client, server: _this._server, event: MAINTENANCE_EXIT$1 }, 'received socket event');
    event.emit(MAINTENANCE_EXIT$1, { requestId: requestId, payload: payload, socket: socket });
  });
}

function startListeners$1() {
  var _this2 = this;

  var useConnection = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;

  var event = this._emitter;
  this.log.info({ method: 'startListeners', server: this._server }, 'socket server is now listening');

  // handle socket events
  if (!useConnection) {
    this.log.info({ server: this._server }, 'Server running in STANDALONE mode, token authentication ' + 'will be required to establish a socket');
    this._io.sockets.on(CONNECTION, socketioJwt.authorize({
      secret: this._tokenStore.secret,
      callback: false
    })).on(AUTHENTICATED, function (socket) {
      return addListeners.call(_this2, socket);
    });
  } else {
    this.log.info({ server: this._server }, 'Server running in INTEGRATED mode, tokens ' + 'should be issued by the application');
  }

  // register local events
  _.forEach(_.get(this, 'backend.events.local'), function (evt, evtName) {
    if (_.isFunction(evt.handler)) {
      _this2.log.trace({ eventRegistered: evtName }, 'registering local event');
      event.on(evtName, function (payload) {
        evt.handler.call(_this2, payload);
      });
    }
  });

  // handle local events
  event.on(SCHEDULE$1, function (_ref8) {
    var requestId = _ref8.requestId,
        payload = _ref8.payload,
        socket = _ref8.socket;

    requestId = !requestId && !socket ? LOCAL_REQUEST : requestId;
    _this2.log.trace({ event: SCHEDULE$1, requestId: requestId }, 'received local event');
    _this2.schedule(payload, socket, requestId);
  });

  event.on(RUN$1, function (_ref9) {
    var requestId = _ref9.requestId,
        socket = _ref9.socket;

    requestId = !requestId && !socket ? LOCAL_REQUEST : requestId;
    _this2.log.trace({ event: RUN$1, requestId: requestId }, 'received local event');
    _this2.run(socket, requestId);
  });

  event.on(STOP$1, function (_ref10) {
    var requestId = _ref10.requestId,
        payload = _ref10.payload,
        socket = _ref10.socket;

    requestId = !requestId && !socket ? LOCAL_REQUEST : requestId;
    _this2.log.trace({ event: STOP$1, requestId: requestId }, 'received local event');
    _this2.stop(payload, socket, requestId);
  });

  event.on(MAINTENANCE_ENTER$1, function (_ref11) {
    var requestId = _ref11.requestId,
        payload = _ref11.payload,
        socket = _ref11.socket;

    requestId = !requestId && !socket ? LOCAL_REQUEST : requestId;
    _this2.log.trace({ event: MAINTENANCE_ENTER$1, requestId: requestId }, 'received local event');
    _this2.maintenance(true, payload, socket, requestId);
  });

  event.on(MAINTENANCE_EXIT$1, function (_ref12) {
    var requestId = _ref12.requestId,
        payload = _ref12.payload,
        socket = _ref12.socket;

    requestId = !requestId && !socket ? LOCAL_REQUEST : requestId;
    _this2.log.trace({ event: MAINTENANCE_EXIT$1, requestId: requestId }, 'received local event');
    _this2.maintenance(false, payload, socket, requestId);
  });

  this.checkQueue();
}

var ONLINE$1 = RunnerNodeStateEnum.values.ONLINE;
var SCHEDULED = RunnerQueueStateEnum.values.SCHEDULED;
var STATUS$1 = EVENTS.STATUS;
var SCHEDULE_ERROR$2 = EVENTS.SCHEDULE_ERROR;
var SCHEDULE_ACCEPT$1 = EVENTS.SCHEDULE_ACCEPT;
var RUN$2 = EVENTS.RUN;
var OK$2 = EVENTS.OK;

var source = 'server/schedule';

// gets the next runner in the list and verifies that it is online
function getNextRunner(list, success, fail) {
  var _this = this;

  var idx = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 0;

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
function checkRunners(context, queue, list, socket, requestId) {
  var _this2 = this;

  var check = new Promise(function (resolve, reject) {
    return getNextRunner.call(_this2, list, resolve, reject);
  });

  this.log.trace({ server: this._server }, 'checking runners for first online');

  return check.then(function (runner) {
    return _this2.queries.updateQueue({
      id: queue.id,
      runner: runner.id,
      state: 'Enum::' + SCHEDULED
    }).then(function () {
      _this2.log.debug({ server: _this2._server, runner: runner.id, queue: queue.id }, 'successfully scheduled queue');
      _this2.emit(runner.host, runner.port, RUN$2, { requestId: requestId }, defineProperty({}, OK$2, function () {
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
function setSchedule(action, context, queue, runners, socket, requestId) {
  var _this3 = this;

  return new Promise(function (resolve, reject) {
    try {
      return _this3.scheduler(_this3, runners, queue, function (error, list) {
        // check for error
        if (error) {
          _this3.log.error({ error: error, source: source, server: _this3._server, method: 'setSchedule' }, 'failed to set schedule');
          if (socket) socket.emit(SCHEDULE_ERROR$2 + '.' + requestId, 'failed to schedule ' + action + ' because ' + error);
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
        checkRunners.call(_this3, context, queue, list, socket, requestId);
        return resolve();
      });
    } catch (error) {
      _this3.log.error({ server: _this3._server, method: 'setSchedule', error: error }, 'failed to schedule');
      reject(error);
    }
  });
}

// get a list of online runners
function getOnlineRunner(action, context, queue, socket, requestId) {
  var _this4 = this;

  return this.queries.readRunner({ state: 'Enum::' + ONLINE$1 }).then(function (runners) {
    _this4.log.debug({ server: _this4._server, source: source }, 'got online runners');
    return setSchedule.call(_this4, action, context, queue, runners, socket, requestId);
  }).catch(function (error) {
    _this4.log.error({ error: error, source: source, server: _this4._server, method: 'getOnlineRunner' }, 'failed to create queue');
    if (socket) return socket.emit(SCHEDULE_ERROR$2 + '.' + requestId, 'failed to schedule ' + action);
  });
}

// Creates a queue document immediately after receiving it then tries to schedule it
function createQueue$1(action, context, socket, requestId) {
  var _this5 = this;

  return this.queries.createQueue(action, context).then(function (queue) {
    _this5.log.debug({ server: _this5._server, source: source }, 'queue created');
    if (socket) socket.emit(SCHEDULE_ACCEPT$1 + '.' + requestId, {});
    return getOnlineRunner.call(_this5, action, context, queue, socket, requestId);
  }).catch(function (error) {
    _this5.log.error({ error: error, source: source, server: _this5._server, method: 'createQueue' }, 'failed to create queue');
    if (socket) return socket.emit(SCHEDULE_ERROR$2 + '.' + requestId, 'failed to schedule ' + action);
  });
}

// entry point for schedule request
function schedule$1(payload, socket, requestId) {
  if (this.state !== ONLINE$1) {
    this.log.debug({ server: this._server, state: this.state }, 'denied schedule request');
    if (socket) socket.emit(SCHEDULE_ERROR$2 + '.' + requestId, 'runner in state ' + this.state + ' and cannot schedule tasks');
    return Promise.reject('runner in state ' + this.state + ' and cannot schedule tasks');
  }

  var action = payload.action,
      context = payload.context;

  // validate that the action is valid

  if (!_.has(this.actions, action)) {
    if (socket) socket.emit(SCHEDULE_ERROR$2 + '.' + requestId, action + ' is not a known action');
    this.log.error({ action: action, source: source }, 'invalid action requested');
    return Promise.reject('invalid action requested');
  }
  return createQueue$1.call(this, action, context, socket, requestId);
}

var _RunnerNodeStateEnum$$1 = RunnerNodeStateEnum.values;
var ONLINE$2 = _RunnerNodeStateEnum$$1.ONLINE;
var MAINTENANCE$2 = _RunnerNodeStateEnum$$1.MAINTENANCE;
var MAINTENANCE_OK$1 = EVENTS.MAINTENANCE_OK;
var MAINTENANCE_ERROR$1 = EVENTS.MAINTENANCE_ERROR;


function maintenance$1(enter, reason, socket, requestId) {
  if (enter && this.state === ONLINE$2) {
    this.log.info({ server: this._server, reason: reason }, 'entering maintenance');
    this.state = MAINTENANCE$2;

    return this.queries.checkIn().then(function () {
      if (socket) socket.emit(MAINTENANCE_OK$1 + '.' + requestId);
      return true;
    });
  } else if (!enter && this.state === MAINTENANCE$2) {
    this.log.info({ server: this._server, reason: reason }, 'exiting maintenance');
    this.state = ONLINE$2;

    return this.queries.checkIn().then(function () {
      if (socket) socket.emit(MAINTENANCE_OK$1 + '.' + requestId);
      return true;
    });
  } else {
    var msg = 'cannot ' + (enter ? 'enter' : 'exit') + ' maintenance while state is ' + this.state;
    if (socket) socket.emit(MAINTENANCE_ERROR$1 + '.' + requestId, msg);
    return Promise.reject(msg);
  }
}

var ONLINE$3 = RunnerNodeStateEnum.values.ONLINE;
var _RunnerQueueStateEnum = RunnerQueueStateEnum.values;
var SCHEDULED$1 = _RunnerQueueStateEnum.SCHEDULED;
var RUNNING = _RunnerQueueStateEnum.RUNNING;
var FAILED = _RunnerQueueStateEnum.FAILED;
var COMPLETE = _RunnerQueueStateEnum.COMPLETE;

// marks failed tasks and logs the error

function setTaskFailed(id, error) {
  var _this = this;

  return this.queries.updateQueue({ id: id, state: 'Enum::' + FAILED }).then(function () {
    _this.log.error({ server: _this._server, error: error, task: id }, 'task failed');
  }).catch(function (error) {
    _this.log.error({ server: _this._server, error: error, task: id }, 'fail status update failed');
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

  var id = task.id,
      action = task.action;

  if (!_.has(this.actions, action)) return this.log.error({ server: this._server, action: action }, 'action is not valid');

  // add the task to the running object to prevent duplicate runs and potentially use for load balancing
  this._running[id] = { action: action, started: new Date() };

  return this.queries.updateQueue({ id: id, state: 'Enum::' + RUNNING }).then(function () {
    try {
      var taskRun = _this4.actions[action](_this4, task, doneTask.call(_this4, id));
      if (_this4.isPromise(taskRun)) {
        return taskRun.then(function () {
          return true;
        }).catch(function (error) {
          return setTaskFailed.call(_this4, id, error instanceof Error ? error : new Error(error));
        });
      }
      return taskRun;
    } catch (err) {
      return setTaskFailed.call(_this4, id, err);
    }
  }).catch(function (error) {
    _this4.log.error({ server: _this4._server, action: action, error: error }, 'failed to update the queue');
    return setTaskFailed.call(_this4, id, error);
  });
}

// resumes a task
function resumeTask(taskId, data) {
  var _this5 = this;

  return this.queries.readQueue({ id: taskId }).then(function (tasks) {
    var task = _.get(tasks, '[0]');
    if (!task) throw new Error('task ' + taskId + ' not found');
    return runTask.call(_this5, _.merge({}, task, { resume: true, data: data }));
  });
}

// gets the tasks assigned to this runner
function getAssigned() {
  var _this6 = this;

  return this.queries.readQueue({ runner: this.id, state: 'Enum::' + SCHEDULED$1 }).then(function (tasks) {
    _this6.log.trace({ server: _this6._server }, 'acquired tasks');
    _.forEach(tasks, function (task) {
      // do not run the task if its already running
      if (!_.has(_this6._running, task.id)) runTask.call(_this6, task);
    });
  }).catch(function (error) {
    _this6.log.debug({ server: _this6._server, error: error }, 'failed to get assigned tasks');
  });
}

// checks for assigned tasks and attempts to run them
function run$1(socket, requestId) {
  if (this.state !== ONLINE$3) {
    this.log.debug({ server: this._server, state: this.state }, 'denied run request');
    if (socket) socket.emit(SCHEDULE_ERROR + '.' + requestId, 'runner in state ' + this.state + ' and cannot run tasks');
    return Promise.reject('runner in state ' + this.state + ' and cannot run tasks');
  }

  this.log.trace({ server: this._server }, 'checking queue');
  if (socket) socket.emit(OK + '.' + requestId);
  return getAssigned.call(this);
}

var STOPPING$1 = EVENTS.STOPPING;
var STOPPING_ACK$1 = EVENTS.STOPPING_ACK;
var OFFLINE$2 = RunnerNodeStateEnum.values.OFFLINE;


function forceStop(socket, requestId) {
  var _this = this;

  this.log.info({ server: this._server }, 'stopping server');

  // if no socket, immediately exit
  if (!socket) process.exit();

  // send an ok response to cleanly exit
  // but also set a timeout for 5 seconds to ensure the process exits
  socket.on(STOPPING_ACK$1, function () {
    _this.log.debug({ server: _this._server }, 'got server stop acknowledgement from client, exiting process');
    process.exit();
  });
  socket.emit(STOPPING$1 + '.' + requestId);
  setTimeout(function () {
    return process.exit();
  }, 5000);
}

function processStop(socket, requestId, options) {
  var _this2 = this;

  var count = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 0;

  // check for force option
  if (options.force) return forceStop.call(this, socket, requestId);
  if (_.keys(this.running).length && count <= options.maxWait) {
    return setTimeout(function () {
      return processStop.call(_this2, socket, requestId, options, count++);
    }, 1000);
  }
  return forceStop.call(this, socket, requestId);
}

function stop$1(options, socket, requestId) {
  var _this3 = this;

  this.log.info({ server: this._server }, 'server stop requested');
  options = !_.isObject(options) ? {} : options;
  options.maxWait = isNaN(options.maxWait) ? 30 : Math.round(Number(options.maxWait));

  // set the runner offline so that it will not be scheduled any new tasks
  this.state = OFFLINE$2;

  // check in to update the database
  return this.queries.checkIn().then(function () {
    return processStop.call(_this3, socket, requestId, options);
  }).catch(function (error) {
    _this3.log.error({ server: _this3._server, error: error }, 'failed to process stop');
    return processStop.call(_this3, socket, requestId, options);
  });
}

var CONNECT = EVENTS.CONNECT;
var UNAUTHORIZED = EVENTS.UNAUTHORIZED;
var AUTHENTICATE$1 = EVENTS.AUTHENTICATE;
var AUTHENTICATED$1 = EVENTS.AUTHENTICATED;
var CONNECT_ERROR = EVENTS.CONNECT_ERROR;
var CONNECT_TIMEOUT = EVENTS.CONNECT_TIMEOUT;


function addListeners$1(socket, listeners, requestId) {
  var _this = this;

  _.forEach(listeners, function (handler, name) {
    var evt = name + '.' + requestId;
    _this.log.trace({ emitter: _this._server, eventName: evt }, 'adding new socket event listener');
    socket.once(evt, function (payload) {
      handler.call(_this, { requestId: requestId, payload: payload, socket: socket });
    });
  });
}

function emit$1(host, port, event, payload) {
  var listeners = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : {};

  var _this2 = this;

  var errorHandler = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : function () {
    return true;
  };
  var timeout = arguments[6];

  var requestId = hat();

  timeout = timeout || this._socketTimeout;

  // proactively renew the token if it is expired
  this._token = this._tokenStore.renewIfExpired();

  // check if emitting to self, if so use local even emitter
  if (host === this._host && port === this._port) return this._emitter.emit(event, payload);

  // check if a socket already exists
  var socket = _.get(this._sockets, host + ':' + port);

  // if it does, emit the event
  if (socket) {
    this.log.trace({ emitter: this._server }, 'socket found');
    addListeners$1.call(this, socket, listeners, requestId);
    this.log.debug({ emitter: this._server, target: host + ':' + port, event: event }, 'emitting event on EXISTING connection');
    return socket.emit(event, { payload: payload, requestId: requestId });
  }

  this.log.trace({ emitter: this._server }, 'creating a new socket');

  // if it does not, initiate a connection
  socket = SocketClient('http' + (this._secureSocket ? 's' : '') + '://' + host + ':' + port, { timeout: timeout });
  _.set(this._sockets, '["' + host + ':' + port + '"]', socket);

  socket.on(CONNECT, function () {
    socket.emit(AUTHENTICATE$1, { token: _this2._token }).on(AUTHENTICATED$1, function () {
      addListeners$1.call(_this2, socket, listeners, requestId);
      _this2.log.debug({ emitter: _this2._server, target: host + ':' + port, event: event }, 'emitting event on NEW connection');
      socket.emit(event, { payload: payload, requestId: requestId });
    }).on(UNAUTHORIZED, function (msg) {
      console.log('unauth', msg);
    });
  });
  // listen for errors
  socket.on(CONNECT_ERROR, function () {
    var s = _.get(_this2._sockets, host + ':' + port);
    if (s) {
      _this2.disconnectSocket(host, port);
      return errorHandler(new Error('socket.io connection error'));
    }
  });
  socket.on(CONNECT_TIMEOUT, function () {
    var s = _.get(_this2._sockets, host + ':' + port);
    if (s) {
      _this2.disconnectSocket(host, port);
      return errorHandler(new Error('socket.io connection timeout error'));
    }
  });
}

var _RunnerNodeStateEnum$ = RunnerNodeStateEnum.values;
var ONLINE = _RunnerNodeStateEnum$.ONLINE;
var MAINTENANCE$1 = _RunnerNodeStateEnum$.MAINTENANCE;
var DISCONNECT = EVENTS.DISCONNECT;
var RUN = EVENTS.RUN;

var YellowjacketServer = function () {
  function YellowjacketServer(backend) {
    var _this = this;

    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    classCallCheck(this, YellowjacketServer);
    var host = options.host,
        port = options.port,
        token = options.token,
        socket = options.socket,
        server = options.server;

    socket = socket || { secure: false, timeout: 2000 };
    server = server || {};

    backend._logLevel = this._logLevel = _.get(LOG_LEVELS, options.loglevel) || LOG_LEVELS.info;
    this.log = this.makeLog(backend.logger || basicLogger.call(this));

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
    this.CONST = CONST;
    backend.server = this;
    this.backend = backend;
    this.actions = backend.actions;
    this.options = options;
    this.scheduler = backend.scheduler || this.defaultScheduler;
    this.lib = backend.lib;
    this._host = host || os.hostname();
    this._port = port || 8080;
    this._server = this._host + ':' + this._port;
    this._emitter = new Events.EventEmitter();
    this._sockets = {};
    this._socketTimeout = socket.timeout || 2000;
    this._secureSocket = Boolean(socket.secure);
    this._running = {};
    this.queries = queries(this);
    this.addListeners = addListeners.bind(this);

    // token settings and creation
    this._tokenStore = tokenStore(this._host, this._port, token);
    this._token = this._tokenStore.token;

    // get the global settings
    return this.queries.getSettings().then(function (settings) {
      _this._appName = settings.appName || 'YELLOWJACKET';
      _this._checkinFrequency = settings.checkinFrequency || 30;
      _this._queueCheckFrequency = settings.queueCheckFrequency || 30;
      _this._offlineAfterPolls = settings.offlineAfterPolls || 1;
      _this._offlineAfter = _this._checkinFrequency * _this._offlineAfterPolls;

      _this.log.info({ server: _this._server }, 'starting server');

      // get self
      return _this.queries.getSelf().then(function (self) {
        _this.id = self.id;
        _this.state = self.state === MAINTENANCE$1 ? MAINTENANCE$1 : ONLINE;

        // check in
        return _this.queries.checkIn(true).then(function () {
          // set up socket.io server
          if (!server.io && !server.app) {
            _this._app = http.createServer(function (req, res) {
              res.writeHead(200);
              res.end('' + _this._server);
            });
            _this._app.listen(port);
            _this._io = new SocketServer(_this._app);
          } else if (server.app && !server.io) {
            _this._app = server.app;
            _this._io = new SocketServer(_this._app);
          } else {
            _this._io = server.io;
          }

          // if the state is online start the listeners
          if (_this.state === ONLINE) _this.startListeners(server.useConnection);
          return _this;
        });
      });
    }).catch(function (error) {
      _this.log.fatal({ server: _this._server, error: error }, 'the server failed to start');
      throw _this;
    });
  }

  createClass(YellowjacketServer, [{
    key: 'checkQueue',
    value: function checkQueue() {
      var _this2 = this;

      setTimeout(function () {
        if (_this2.state === ONLINE) {
          _this2.log.trace({ server: _this2._server, app: _this2._appName }, 'system initiated run queue check');
          _this2._emitter.emit(RUN, {});
          _this2.checkQueue();
        }
      }, this._queueCheckFrequency * 1000);
    }
  }, {
    key: 'isPromise',
    value: function isPromise(obj) {
      return _.isFunction(_.get(obj, 'then')) && _.isFunction(_.get(obj, 'catch'));
    }
  }, {
    key: 'startListeners',
    value: function startListeners(useConnection) {
      startListeners$1.call(this, useConnection);
    }
  }, {
    key: 'emit',
    value: function emit(host, port, event, payload, listener, cb, timeout) {
      return emit$1.call(this, host, port, event, payload, listener, cb, timeout);
    }
  }, {
    key: 'renewToken',
    value: function renewToken() {
      this._tokenStore.renew();
      this._token = this._tokenStore.token;
      return this._token;
    }
  }, {
    key: 'schedule',
    value: function schedule(payload, socket, requestId) {
      return schedule$1.call(this, payload, socket, requestId);
    }
  }, {
    key: 'run',
    value: function run(socket, requestId) {
      return run$1.call(this, socket, requestId);
    }
  }, {
    key: 'done',
    value: function done(err, taskId, status, data) {
      return doneTask.call(this, taskId)(err, status, data);
    }
  }, {
    key: 'resume',
    value: function resume(taskId, data) {
      return resumeTask.call(this, taskId, data);
    }
  }, {
    key: 'stop',
    value: function stop(options, socket, requestId) {
      return stop$1.call(this, options, socket, requestId);
    }
  }, {
    key: 'maintenance',
    value: function maintenance(enter, reason, socket, requestId) {
      return maintenance$1.call(this, enter, reason, socket, requestId);
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
  }, {
    key: 'makeLog',
    value: function makeLog(logger) {
      var _this3 = this;

      var updateArgs = function updateArgs(args) {
        if (args.length && _.isObject(args[0])) args[0] = _.merge({ server: _this3._server }, args[0]);else args = [obj].concat(args);
        return args;
      };

      return {
        fatal: function fatal() {
          if (_.isFunction(_.get(logger, 'fatal'))) logger.fatal.apply(this, updateArgs([].concat(Array.prototype.slice.call(arguments))));
        },
        error: function error() {
          if (_.isFunction(_.get(logger, 'error'))) logger.error.apply(this, updateArgs([].concat(Array.prototype.slice.call(arguments))));
        },
        warn: function warn() {
          if (_.isFunction(_.get(logger, 'warn'))) logger.warn.apply(this, updateArgs([].concat(Array.prototype.slice.call(arguments))));
        },
        info: function info() {
          if (_.isFunction(_.get(logger, 'info'))) logger.info.apply(this, updateArgs([].concat(Array.prototype.slice.call(arguments))));
        },
        debug: function debug() {
          if (_.isFunction(_.get(logger, 'debug'))) logger.debug.apply(this, updateArgs([].concat(Array.prototype.slice.call(arguments))));
        },
        trace: function trace() {
          if (_.isFunction(_.get(logger, 'trace'))) logger.trace.apply(this, updateArgs([].concat(Array.prototype.slice.call(arguments))));
        }
      };
    }
  }]);
  return YellowjacketServer;
}();

var DISCONNECT$1 = EVENTS.DISCONNECT;
var OK$3 = EVENTS.OK;

var YellowjacketClient = function () {
  function YellowjacketClient(backend) {
    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    classCallCheck(this, YellowjacketClient);
    var socket = options.socket,
        token = options.token,
        host = options.host,
        port = options.port;


    this._logLevel = _.get(LOG_LEVELS, options.loglevel) || LOG_LEVELS.info;
    this.log = backend.logger || basicLogger.call(this);

    socket = socket || {};
    this.CONST = CONST;
    this._backend = backend;
    this._emitter = new Events.EventEmitter();
    this._host = host || 'localhost';
    this._port = port || 8080;
    this._server = this._host + ':' + this._port;
    this._tokenStore = tokenStore(this._host, this._port, token);
    this._token = this._tokenStore.token;
    this._sockets = {};
    this._socketTimeout = socket.timeout || 2000;
    this._secureSocket = Boolean(socket.secure);
  }

  createClass(YellowjacketClient, [{
    key: 'emit',
    value: function emit(host, port, event, payload, listener, cb, timeout) {
      return emit$1.call(this, host, port, event, payload, listener, cb, timeout);
    }
  }, {
    key: 'renewToken',
    value: function renewToken() {
      this._tokenStore.renew();
      this._token = this._tokenStore.token;
      return this._token;
    }
  }, {
    key: 'disconnectSocket',
    value: function disconnectSocket(host, port) {
      this.log.debug({ server: this._server, target: host + ':' + port }, 'disconnecting socket');
      this.emit(host, port, DISCONNECT$1, undefined, OK$3, function () {
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

var STOP = EVENTS.STOP;
var SCHEDULE = EVENTS.SCHEDULE;
var SCHEDULE_ACCEPT = EVENTS.SCHEDULE_ACCEPT;
var SCHEDULE_ERROR$1 = EVENTS.SCHEDULE_ERROR;
var MAINTENANCE_ENTER = EVENTS.MAINTENANCE_ENTER;
var MAINTENANCE_EXIT = EVENTS.MAINTENANCE_EXIT;
var MAINTENANCE_ERROR = EVENTS.MAINTENANCE_ERROR;
var MAINTENANCE_OK = EVENTS.MAINTENANCE_OK;
var STOPPING = EVENTS.STOPPING;
var STOPPING_ACK = EVENTS.STOPPING_ACK;


function listRunner(args) {
  return this.queries.readRunner(args);
}

function addRunner(args) {
  if (!_.isObject(args)) throw new Error('No options provided');
  var host = args.host,
      port = args.port,
      zone = args.zone,
      metadata = args.metadata;

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
  return new YellowjacketServer(this, options);
}

function scheduleRunner(_ref) {
  var host = _ref.host,
      port = _ref.port,
      action = _ref.action,
      context = _ref.context,
      _ref$loglevel = _ref.loglevel,
      loglevel = _ref$loglevel === undefined ? LOG_LEVELS.info : _ref$loglevel;

  var client = new YellowjacketClient(this, { loglevel: loglevel });

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

function stopRunner(_ref2) {
  var host = _ref2.host,
      port = _ref2.port,
      _ref2$loglevel = _ref2.loglevel,
      loglevel = _ref2$loglevel === undefined ? LOG_LEVELS.info : _ref2$loglevel;

  var client = new YellowjacketClient(this, { loglevel: loglevel });

  return new Promise(function (resolve, reject) {
    client.emit(host, port, STOP, {}, defineProperty({}, STOPPING, function (socket) {
      socket.emit(STOPPING_ACK);
      resolve('Server stopped');
    }), function (error) {
      reject(error);
    });
  });
}

function maintenanceRunner(_ref3) {
  var host = _ref3.host,
      port = _ref3.port,
      exit = _ref3.exit,
      reason = _ref3.reason,
      _ref3$loglevel = _ref3.loglevel,
      loglevel = _ref3$loglevel === undefined ? LOG_LEVELS.info : _ref3$loglevel;

  var client = new YellowjacketClient(this, { loglevel: loglevel });

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
  this.addInstallData(data);

  return this.initAllStores(true, this._installData);
}

function cmd(command) {
  var _this = this;

  return new Promise(function (resolve, reject) {
    if (!_.isObject(command)) return reject(Error('Invalid command object'));

    var target = command.target,
        action = command.action,
        options = command.options;

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
          case 'stop':
            return resolve(stopRunner.call(_this, options));
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
            logfile: { type: 'String' },
            token: { type: 'JSON' },
            socket: { type: 'JSON' }
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

var getOptions = function () {
  var customConfig = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
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
};

function cli(config, parser) {
  var options = getOptions(config, parser);
  this.cmd(options).then(function (result) {
    if (!(result instanceof YellowjacketServer)) {
      try {
        console.log(JSON.stringify(result, null, '  '));
      } catch (err) {
        console.log(result);
      }
      process.exit();
    }
  }).catch(function (error) {
    if (!(error instanceof YellowjacketServer)) {
      console.error(error.message);
      process.exit();
    }
  });
}

function union(a, b) {
  a = a ? a : [];
  a = _.isArray(a) ? a : [a];
  b = b ? b : [];
  b = _.isArray(b) ? b : [b];
  return _.union(a, b);
}

var BACKEND_EXT = '_backend';

function prepareConfig(config) {
  // merge plugins
  var plugin = config.plugin,
      options = config.options;

  var schemaNames = _.union(_.get(options, 'schemas', []), ['Yellowjacket']);
  var backendExtension = _.get(options, 'backendExtension', BACKEND_EXT);

  // clone the type definitions
  var types$$1 = _.cloneDeep(typeDefinitions);

  // move the backend extension if set
  _.forEach(types$$1, function (definition) {
    var _backend = _.get(definition, BACKEND_EXT);
    if (_.isObject(_backend) && backendExtension !== BACKEND_EXT) {
      definition[backendExtension] = _backend;
      delete definition._backend;
    }
  });

  // add custom schema names
  _.forEach(types$$1, function (definition) {
    if (_.has(definition, '["' + backendExtension + '"]')) {
      definition[backendExtension].schema = schemaNames;
    }
  });

  // merge config
  return _.merge({}, config, {
    types: types$$1,
    plugin: union(plugin, FactoryTypePlugin),
    extension: backendExtension
  });
}

var YellowjacketRethinkDBBackend = function (_GraphQLFactoryRethin) {
  inherits(YellowjacketRethinkDBBackend, _GraphQLFactoryRethin);

  function YellowjacketRethinkDBBackend(namespace, graphql, r) {
    var config = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
    var connection = arguments[4];
    classCallCheck(this, YellowjacketRethinkDBBackend);

    var _this = possibleConstructorReturn(this, (YellowjacketRethinkDBBackend.__proto__ || Object.getPrototypeOf(YellowjacketRethinkDBBackend)).call(this, namespace, graphql, factory, r, prepareConfig(config), connection));

    _this.type = 'YellowjacketRethinkDBBackend';
    _this.CONST = CONST;
    _this.actions = {};
    _this.events = {
      local: {},
      socket: {}
    };

    // add actions and scheduler and logger
    var actions = config.actions,
        scheduler = config.scheduler,
        logger = config.logger;


    if (_.isFunction(actions) || _.isObject(actions)) {
      actions = _.isFunction(actions) ? actions(_this) : actions;
      _this.actions = _.merge({}, _this.actions, actions);
    }

    if (_.isFunction(scheduler)) _this.scheduler = scheduler;
    _this.logger = logger;
    _this.log = logger || basicLogger.call(_this);

    // add install data
    _this.addInstallData(installData);

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
  }, {
    key: 'addEvents',
    value: function addEvents(events) {
      if (_.has(events, 'local')) _.merge(this.events.local, events.local);
      if (_.has(events, 'socket')) _.merge(this.events.socket, events.socket);
    }
  }, {
    key: 'client',
    value: function client(options) {
      return YellowjacketClient(this, options);
    }
  }, {
    key: 'createServer',
    value: function createServer(options) {
      return new YellowjacketServer(this, options);
    }
  }]);
  return YellowjacketRethinkDBBackend;
}(graphqlFactoryBackend.GraphQLFactoryRethinkDBBackend);

var index = {
  YellowjacketRethinkDBBackend: YellowjacketRethinkDBBackend,
  YellowjacketClient: YellowjacketClient,
  YellowjacketServer: YellowjacketServer
};

exports.YellowjacketRethinkDBBackend = YellowjacketRethinkDBBackend;
exports.YellowjacketClient = YellowjacketClient;
exports.YellowjacketServer = YellowjacketServer;
exports['default'] = index;
