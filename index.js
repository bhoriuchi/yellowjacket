'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var _ = _interopDefault(require('lodash'));
var factory = _interopDefault(require('graphql-factory'));
var FactoryTypePlugin = _interopDefault(require('graphql-factory-types'));
var chalk = _interopDefault(require('chalk'));
var NestedOpts = _interopDefault(require('nested-opts'));
var http = _interopDefault(require('http'));
var SocketServer = _interopDefault(require('socket.io'));
var bunyan = _interopDefault(require('bunyan'));
var SocketClient = _interopDefault(require('socket.io-client'));

var Runner = {
  query: 'RunnerQuery',
  mutation: 'RunnerMutation'
};

var schemas = {
  Runner: Runner
};

var RunnerMutation = {
  fields: {
    createQueue: {
      type: 'RunnerQueue',
      args: {
        state: { type: 'RunnerQueueStateEnum', defaultValue: 'UNSCHEDULED' },
        forwarded: { type: 'Int', defaultValue: 0 },
        action: { type: 'String', nullable: false },
        context: { type: 'FactoryJSON', defaultValue: {} }
      },
      resolve: 'createQueue'
    },
    updateQueue: {
      type: 'RunnerQueue',
      args: {
        id: { type: 'String', nullable: false },
        runner: { type: 'String' },
        state: { type: 'RunnerQueueStateEnum' },
        forwarded: { type: 'Int' },
        context: { type: 'FactoryJSON' }
      },
      resolve: 'updateQueue'
    },
    deleteQueue: {
      type: 'Boolean',
      args: {
        id: { type: 'String', nullable: false }
      },
      resolve: 'deleteQueue'
    },
    createRunner: {
      type: 'RunnerNode',
      args: {
        host: { type: 'String', nullable: false },
        port: { type: 'Int', defaultValue: 8080 },
        zone: { type: 'String', defaultValue: null },
        metadata: { type: 'FactoryJSON', defaultValue: {} }
      },
      resolve: 'createRunner'
    },
    updateRunner: {
      type: 'RunnerNode',
      args: {
        id: { type: 'String', nullable: false },
        host: { type: 'String' },
        port: { type: 'Int' },
        zone: { type: 'String' },
        state: { type: 'RunnerNodeStateEnum' },
        checkin: { type: 'FactoryDateTime' },
        metadata: { type: 'FactoryJSON' }
      },
      resolve: 'updateRunner'
    },
    deleteRunner: {
      type: 'Boolean',
      args: {
        id: { type: 'String', nullable: false }
      },
      resolve: 'deleteRunner'
    },
    createSettings: {
      type: 'RunnerSettings',
      args: {
        appName: { type: 'String', defaultValue: 'YELLOWJACKET' },
        checkinFrequency: { type: 'Int', defaultValue: 30 },
        offlineAfterPolls: { type: 'Int', defaultValue: 1 }
      },
      resolve: 'createSettings'
    },
    readSettings: {
      type: 'RunnerSettings',
      resolve: 'readSettings'
    },
    updateSettings: {
      type: 'RunnerSettings',
      args: {
        appName: { type: 'String' },
        checkinFrequency: { type: 'Int' },
        offlineAfterPolls: { type: 'Int' }
      },
      resolve: 'updateSettings'
    },
    deleteSettings: {
      type: 'Boolean',
      resolve: 'deleteSettings'
    },
    createZone: {
      type: 'RunnerZone',
      args: {
        name: { type: 'String', nullable: false },
        description: { type: 'String' },
        metadata: { type: 'FactoryJSON', defaultValue: {} }
      },
      resolve: 'createZone'
    },
    updateZone: {
      type: 'RunnerZone',
      args: {
        id: { type: 'String', nullable: false },
        name: { type: 'String' },
        description: { type: 'String' },
        metadata: { type: 'FactoryJSON' }
      },
      resolve: 'updateZone'
    },
    deleteZone: {
      type: 'Boolean',
      args: {
        id: { type: 'String', nullable: false }
      },
      resolve: 'deleteZone'
    },
    checkinRunner: {
      type: 'Boolean',
      args: {
        id: { type: 'String', nullable: false },
        state: { type: 'RunnerNodeStateEnum', nullable: false },
        offlineAfter: { type: 'Int', nullable: false }
      },
      resolve: 'checkinRunner'
    }
  }
};

var RunnerNode = {
  fields: {
    id: {
      type: 'String'
    },
    host: {
      description: 'Host name or IP address for the runner',
      type: 'String'
    },
    port: {
      description: 'Port the runner listens on',
      type: 'Int'
    },
    zone: {
      description: 'Zone the runner belongs to',
      type: 'RunnerZone',
      resolve: 'readZone'
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
  }
};

var RunnerState = {
  type: 'Enum',
  values: {
    ONLINE: 'ONLINE',
    OFFLINE: 'OFFLINE',
    MAINTENANCE: 'MAINTENANCE',
    UNKNOWN: 'UNKNOWN'
  }
};

var RunnerQuery = {
  fields: {
    readQueue: {
      type: ['RunnerQueue'],
      args: {
        id: { type: 'String' },
        runner: { type: 'String' },
        state: { type: 'RunnerQueueStateEnum' }
      },
      resolve: 'readQueue'
    },
    readRunner: {
      type: ['RunnerNode'],
      args: {
        id: { type: 'String' },
        host: { type: 'String' },
        port: { type: 'Int' },
        zone: { type: 'String' },
        state: { type: 'RunnerNodeStateEnum' }
      },
      resolve: 'readRunner'
    },
    readSettings: {
      type: 'RunnerSettings',
      resolve: 'readSettings'
    },
    readZone: {
      type: ['RunnerZone'],
      args: {
        id: { type: 'String' }
      },
      resolve: 'readZone'
    }
  }
};

var RunnerQueue = {
  fields: {
    id: {
      type: 'String'
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
  }
};

var QueueState = {
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

var RunnerSettings = {
  fields: {
    id: {
      type: 'String'
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
  }
};

var RunnerZone = {
  fields: {
    id: {
      type: 'String'
    },
    name: {
      description: 'Zone name',
      type: 'String'
    },
    description: {
      description: 'Describe the zone',
      type: 'String'
    },
    metadata: {
      description: 'Generic supporting data',
      type: 'FactoryJSON'
    }
  }
};

var types = {
  RunnerMutation: RunnerMutation,
  RunnerNode: RunnerNode,
  RunnerNodeStateEnum: RunnerState,
  RunnerQuery: RunnerQuery,
  RunnerQueue: RunnerQueue,
  RunnerQueueStateEnum: QueueState,
  RunnerSettings: RunnerSettings,
  RunnerZone: RunnerZone
};

function gql (backend) {
  var factory$$ = factory(backend._graphql);
  var functions = backend.functions;
  return factory$$.make({ functions: functions, types: types, schemas: schemas }, { plugin: [FactoryTypePlugin] });
}

var config = {
  options: {
    error: function error(err) {
      console.error(chalk.red('ERROR:', err.message || err));
      process.exit();
    }
  },
  commands: {
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
            id: { type: 'String' },
            host: { type: 'String' },
            port: { type: 'Int' }
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
            id: { type: 'String' },
            host: { type: 'String' },
            port: { type: 'Int' }
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
  var options = {};
  var opts = NestedOpts(config).options;

  if (!opts.valid) return;

  options.target = opts.command;
  if (opts.subcommand) {
    options.action = opts.subcommand.command;
    options.options = opts.subcommand.options;
  } else if (opts.options) {
    options.options = opts.options;
  }
  options.showHelp = function () {
    return 'placeholder for showhelp';
  };
  return options;
}

function add (lib, helper) {
  var error = helper.error;
  var pretty = helper.pretty;
  var options = helper.options;
  var _options$options = options.options;
  var host = _options$options.host;
  var port = _options$options.port;


  var args = [];
  if (!host) error('Add operation requires a host option');
  if (port) args.push('port: ' + port);
  args.push('host: "' + host + '"');

  lib.Runner('mutation Mutation {\n  createRunner (\n    ' + args.join(', ') + '\n  ) {\n    id,\n    host,\n    port,\n    state,\n    metadata\n  }\n}').then(function (res) {
    if (res.errors) return error(pretty(_.get(res, 'errors[0].message', res.errors)));
    console.log(chalk.green.bold('Added Node:'));
    console.log(chalk.green(pretty(res, 'data.createRunner')));
    process.exit();
  }).catch(error);
}

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
  RESTART_ERROR: 'restart.error'
};

var CONNECTION = EVENTS.CONNECTION;
var CONNECTED = EVENTS.CONNECTED;
var STATUS = EVENTS.STATUS;
var SCHEDULE = EVENTS.SCHEDULE;
var RUN = EVENTS.RUN;
var STOP = EVENTS.STOP;


function startListeners() {
  var _this = this;

  this.logInfo('Socket server is now listening on ' + this._server, { method: 'startListeners' });

  this._io.on(CONNECTION, function (socket) {
    _this.logDebug('Connection made', { client: _.get(socket, 'conn.remoteAddress', 'unknown') });
    socket.emit(CONNECTED);
    socket.on(STATUS, function () {
      return socket.emit(STATUS, _this.info());
    });
    socket.on(SCHEDULE, function (payload) {
      return _this.schedule(socket, payload);
    });
    socket.on(RUN, _this.run(socket));
    socket.on(STOP, function () {
      var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
      return _this.stop(socket, options);
    });
  });
}

function getSelf() {
  var _this = this;

  return this._lib.Runner('{\n  readRunner (\n    host: "' + this._host + '",\n    port: ' + this._port + '\n  )\n  {\n    id,\n    state\n  }\n}').then(function (result) {
    var runner = _.get(result, 'data.readRunner[0]');
    if (result.errors) throw new Error(result.errors);
    if (!runner) throw new Error('Runner with host:port ' + _this._server + ' must be added first');
    return runner;
  });
}

function getSettings() {
  this.logTrace('Getting global settings ' + this._server);
  return this._lib.Runner('{ readSettings { appName, checkinFrequency, offlineAfterPolls } }').then(function (result) {
    var settings = _.get(result, 'data.readSettings');
    if (result.errors) throw new Error(result.errors);
    if (!settings) throw new Error('No settings document was found');
    return settings;
  });
}

// export enums
var OFFLINE = RunnerState.values.OFFLINE;
var ONLINE = RunnerState.values.ONLINE;
var MAINTENANCE = RunnerState.values.MAINTENANCE;

var ONE_SECOND_IN_MS = 1000;

var LOG_LEVELS = {
  fatal: 60,
  error: 50,
  warn: 40,
  info: 30,
  debug: 20,
  trace: 10,
  silent: 100
};

function expandGQLErrors(errors) {
  if (_.isArray(errors)) {
    return _.map(errors, function (e) {
      try {
        return _.isObject(e) ? JSON.stringify(e) : e;
      } catch (err) {
        return e;
      }
    });
  }
  try {
    return _.isObject(errors) ? JSON.stringify(errors) : errors;
  } catch (err) {
    return errors;
  }
}

function logLevel() {
  var level = arguments.length <= 0 || arguments[0] === undefined ? 'info' : arguments[0];

  level = _.toLower(level);
  return _.get(LOG_LEVELS, level, LOG_LEVELS.info);
}

function getLogConfig(appName) {
  var level = arguments.length <= 1 || arguments[1] === undefined ? 'info' : arguments[1];
  var file = arguments[2];

  level = logLevel(level);
  var logStreams = [{ stream: process.stdout, level: level }];
  if (file) logStreams.push({ path: logfile, level: level });
  return { name: appName, streams: logStreams };
}

function checkin(first) {
  var _this = this;

  var msg = first ? 'First check in for ' + this._server : 'Checking in ' + this._server;
  this.logTrace(msg);
  setTimeout(function () {
    return _this.checkin();
  }, this._checkinFrequency * ONE_SECOND_IN_MS);

  return this._lib.Runner('mutation Mutation {\n  checkinRunner (\n    id: "' + this._id + '",\n    state: ' + this._state + ',\n    offlineAfter: ' + this._offlineAfter + '\n  )\n}').then(function (result) {
    var runner = _.get(result, 'data.checkinRunner');
    if (result.errors) throw new Error(result.errors);
    if (!runner) throw new Error('Runner with host:port ' + _this._server + ' was unable to checkin');
    return runner;
  });
}

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

var source = 'server/schedule.js';
var _QueueState$values = QueueState.values;
var SCHEDULED = _QueueState$values.SCHEDULED;
var UNSCHEDULED = _QueueState$values.UNSCHEDULED;
var ONLINE$1 = RunnerState.values.ONLINE;
var CONNECTED$1 = EVENTS.CONNECTED;
var CONNECT_ERROR = EVENTS.CONNECT_ERROR;
var CONNECT_TIMEOUT = EVENTS.CONNECT_TIMEOUT;
var DISCONNECT = EVENTS.DISCONNECT;
var STATUS$1 = EVENTS.STATUS;
var SCHEDULE_ERROR = EVENTS.SCHEDULE_ERROR;
var SCHEDULE_ACCEPT = EVENTS.SCHEDULE_ACCEPT;
var RUN$1 = EVENTS.RUN;
var OK = EVENTS.OK;

// cleans up socket connection

function disconnectSocket(socket) {
  socket.emit(DISCONNECT);
  socket.disconnect(0);
  return true;
}

/*
 * Sends a message and then disconnects after response or error
 */
function emitOnce(host, port, evt, listeners) {
  var onError = arguments.length <= 4 || arguments[4] === undefined ? function () {
    return false;
  } : arguments[4];
  var timeout = arguments.length <= 5 || arguments[5] === undefined ? 2000 : arguments[5];

  var disconnected = false;
  var socket = SocketClient('http://' + host + ':' + port, { timeout: timeout });

  socket.on(CONNECTED$1, function () {
    return socket.emit(evt);
  });

  _.forEach(listeners, function (fn, e) {
    socket.on(e, function (data) {
      disconnected = disconnectSocket(socket);
      return fn(data);
    });
  });

  socket.on(CONNECT_ERROR, function () {
    if (!disconnected) {
      disconnected = disconnectSocket(socket);
      return onError();
    }
  });
  socket.on(CONNECT_TIMEOUT, function () {
    if (!disconnected) {
      disconnected = disconnectSocket(socket);
      return onError();
    }
  });
}

/*
 * Loops through each node in the node list and determines if it is reachable
 */
function getNextRunner(nodeList, success, fail) {
  var _this = this;

  var idx = arguments.length <= 3 || arguments[3] === undefined ? 0 : arguments[3];

  if (idx >= nodeList.length) {
    if (this._state === ONLINE$1) return success(this.info());else return fail(new Error('No runners meet the run requirements'));
  }
  var node = nodeList[idx];
  idx++;
  if (node.id === this._id && this._state === ONLINE$1) return success(node);
  if (!node.host || !node.port) return getNextRunner.call(this, nodeList, success, fail, idx);

  return emitOnce(node.host, node.port, STATUS$1, defineProperty({}, STATUS$1, function (data) {
    if (data.state === ONLINE$1) return resolve(data);else return getNextRunner.call(_this, nodeList, success, fail, idx);
  }), function () {
    return getNextRunner.call(_this, nodeList, success, fail, idx);
  });
}

/*
 * Entry point for checking online runners
 */
function checkRunners(nodeList) {
  var _this2 = this;

  return new Promise(function (resolve, reject) {
    return getNextRunner.call(_this2, nodeList, resolve, reject);
  });
}

/*
 * Assigns task to a runner
 */
function setSchedule(socket, action, context, nodes, queue) {
  var _this3 = this;

  return new Promise(function (resolve, reject) {
    return _this3._scheduler(_this3, nodes, queue, function (err, nodeList) {
      if (err) {
        _this3.logDebug('Failed to schedule', {
          method: 'schedule',
          errors: err.message || err,
          stack: err.stack,
          action: action,
          marker: 3,
          source: source
        });
        socket.emit(SCHEDULE_ERROR, 'failed to schedule ' + action + ' because ' + err);
        return reject(err);
      }

      // fallback to self if no nodes
      if (!_.isArray(nodeList)) {
        if (_this3._state !== ONLINE$1) return reject(new Error('No acceptable nodes were found'));
        nodeList = [_this3.info()];
      }

      // attempt to ping the runners
      return resolve(checkRunners.call(_this3, nodeList).then(function (node) {
        return _this3._lib.Runner('\n            mutation Mutation {\n              updateQueue (\n                id: "' + queue.id + '",\n                runner: "' + node.id + '",\n                state: ' + SCHEDULED + '\n              ) { id }\n            }\n          ').then(function (result) {
          var queue = _.get(result, 'data.updateQueue', {});
          if (result.errors || !queue.id) throw new Error('Failed to update queue');
          _this3.logInfo('Successfully scheduled queue', { runner: node.id, queue: queue.id });
          return emitOnce(node.host, node.port, RUN$1, defineProperty({}, OK, function () {
            return disconnectSocket(socket);
          }));
        }).catch(function (err) {
          _this3.logDebug('Failed to schedule', {
            method: 'schedule',
            errors: err.message || err,
            stack: err.stack,
            action: action,
            marker: 4,
            source: source
          });
        });
      }));
    });
  });
}

/*
 * Queries runner document for online runners and then calls
 * function to check node directly via socket status message
 */
function getOnlineRunner(socket, action, context, queue) {
  var _this4 = this;

  // get nodes that appear to be online
  return this._lib.Runner('{\n            readRunner (state: ' + ONLINE$1 + ') { id, host, port, zone { id, name, description, metadata }, state, metadata }\n          }').then(function (result) {
    var nodes = _.get(result, 'data.readRunner');
    if (result.errors || !nodes) {
      _this4.logDebug('Failed to schedule', {
        method: 'schedule',
        errors: result.errors,
        action: action,
        marker: 2,
        source: source
      });
      return socket.emit(SCHEDULE_ERROR, 'failed to schedule ' + action);
    }
    return setSchedule.call(_this4, socket, action, context, nodes, queue);
  }).catch(function (err) {
    _this4.logDebug('Failed to schedule', {
      method: 'schedule',
      errors: err.message || err,
      stack: err.stack,
      action: action,
      marker: 5,
      source: source
    });
  });
}

/*
 * Creates a queue document immediately after receiving it then tries to schedule it
 */
function createQueue(socket, action, context) {
  var _this5 = this;

  return this._lib.Runner('mutation Mutation {\n      createQueue (\n        action: "' + action + '",\n        context: ' + factory.utils.toObjectString(context) + ',\n        state: ' + UNSCHEDULED + '\n      ) { id, action, context }  \n    }').then(function (result) {
    var queue = _.get(result, 'data.createQueue');
    if (result.errors || !queue) {
      _this5.logDebug('Failed to schedule', {
        method: 'schedule',
        errors: result.errors,
        action: action,
        marker: 1,
        source: source
      });
      return socket.emit('schedule.error', 'failed to schedule ' + action);
    } else {
      socket.emit(SCHEDULE_ACCEPT);
      return getOnlineRunner.call(_this5, socket, action, context, queue);
    }
  }).catch(function (err) {
    _this5.logDebug('Failed to schedule', {
      method: 'schedule',
      errors: err.message || err,
      stack: err.stack,
      action: action,
      marker: 4,
      source: source
    });
    return socket.emit(SCHEDULE_ERROR, 'failed to schedule ' + action);
  });
}

// entry point for schedule request
function schedule(socket, payload) {
  var action = payload.action;
  var context = payload.context;

  if (!_.has(this._actions, action)) {
    socket.emit(SCHEDULE_ERROR, action + ' is not a known action');
    this.logError('Invalid action requested', { method: 'schedule', action: action, source: source });
    return new Promise(function (resolve, reject) {
      return reject('Invalid action requested');
    });
  }
  return createQueue.call(this, socket, action, context);
}

var _QueueState$values$1 = QueueState.values;
var SCHEDULED$1 = _QueueState$values$1.SCHEDULED;
var RUNNING = _QueueState$values$1.RUNNING;
var FAILED = _QueueState$values$1.FAILED;
var COMPLETE = _QueueState$values$1.COMPLETE;
var OK$1 = EVENTS.OK;

var source$1 = 'server/run.js';

function setTaskFailed(id, error) {
  var _this = this;

  return this._lib.Runner('mutation Mutation {\n    updateQueue (\n      id: "' + id + '",\n      state: ' + FAILED + '\n    ) { id }\n  }').then(function () {
    throw error instanceof Error ? error : new Error(error);
  }).catch(function (err) {
    _this.logDebug('Run failed', {
      method: 'setTaskFailed',
      errors: err.message || err,
      stack: err.stack,
      marker: 3,
      source: source$1,
      runner: _this._id,
      queue: id
    });
  });
}

function setTaskComplete(id, data) {
  var _this2 = this;

  return this._lib.Runner('mutation Mutation { deleteQueue (id: "' + id + '") }').then(function () {
    _this2.logDebug('Task completed successfully', {
      method: 'run',
      runData: data,
      marker: 4,
      source: source$1,
      runner: _this2._id,
      queue: id
    });
  }).catch(function (err) {
    _this2.logDebug('Complete task failed', {
      method: 'run',
      errors: err.message || err,
      stack: err.stack,
      marker: 5,
      source: source$1,
      runner: _this2._id,
      queue: id
    });
  });
}

function doneTask(taskId) {
  var _this3 = this;

  return function (err, status, data) {
    delete _this3.running[taskId];
    status = _.includes([COMPLETE, FAILED], _.toUpper(status)) ? status : COMPLETE;
    data = data || status;
    if (err || status === FAILED) return setTaskFailed.call(_this3, taskId, err || data);
    return setTaskComplete.call(_this3, taskId, data);
  };
}

function runTask(task) {
  var _this4 = this;

  var id = task.id;
  var action = task.action;
  var context = task.context;

  if (!_.has(this._actions, action)) {
    return this.logError('Requested action is not valid', { action: action, method: 'runTask', source: source$1 });
  }
  return this._lib.Runner('mutation Mutation {\n    updateQueue (\n      id: "' + id + '",\n      state: ' + RUNNING + '\n    ) { id }\n  }').then(function (result) {
    if (result.errors) throw new Error(expandGQLErrors(result.errors));
    try {
      _this4.running[id] = { action: action, started: new Date() };
      var taskRun = _this4._actions[action](_this4, context, doneTask.bind(_this4)(id));
      if (_.isFunction(_.get(taskRun, 'then')) && _.isFunction(_.get(taskRun, 'catch'))) {
        return taskRun.then(function () {
          return true;
        }).catch(function (err) {
          throw err instanceof Error ? err : new Error(err);
        });
      }
      return taskRun;
    } catch (err) {
      throw err;
    }
  }).catch(function (err) {
    delete _this4.running[id];
    _this4.logDebug('Run failed', {
      method: 'run',
      errors: err.message || err,
      stack: err.stack,
      marker: 1,
      source: source$1,
      runner: _this4._id,
      queue: id
    });
  });
}

function getAssigned() {
  var _this5 = this;

  return this._lib.Runner('{\n      readQueue (\n        runner: "' + this._id + '",\n        state: ' + SCHEDULED$1 + '\n      ) { id, action, context }\n    }').then(function (result) {
    var queue = _.get(result, 'data.readQueue');
    if (result.errors) throw new Error(expandGQLErrors(result.errors));
    _.forEach(queue, function (task) {
      return runTask.call(_this5, task);
    });
  }).catch(function (err) {
    _this5.logDebug('Failed query run queue', {
      method: 'run',
      errors: err.message || err,
      stack: err.stack,
      marker: 2,
      source: source$1
    });
  });
}

function run(socket) {
  var _this6 = this;

  return function () {
    _this6.logTrace('Checking queue');
    if (socket) socket.emit(OK$1);
    return getAssigned.call(_this6);
  };
}

var OK$2 = EVENTS.OK;


function forceStop(socket) {
  // send an ok response to cleanly exit
  // but also set a timeout for 5 seconds to ensure the process exits
  socket.emit(OK$2);
  socket.on(OK$2, function () {
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

function stop(socket) {
  var _this2 = this;

  var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

  this.logInfo('Server stop requested');
  options.maxWait = isNaN(options.maxWait) ? 30 : Math.round(Number(options.maxWait));

  // set the runner offline so that it will not be scheduled any new tasks
  this.state = OFFLINE;

  // check in to update the database
  return this.checkin().then(function () {
    return processStop.call(_this2, socket, options);
  }).catch(function () {
    return processStop.call(_this2, socket, options);
  });
}

// server object constructor
function Server(backend, lib, options, actions, scheduler) {
  var _this = this;

  if (!(this instanceof Server)) return new Server(backend, lib, options, actions, scheduler);
  backend.server = this;
  var host = options.host;
  var port = options.port;
  var loglevel = options.loglevel;
  var logfile = options.logfile;

  // check that the actions and scheduler are functions

  if (!_.isObject(actions) || !_.isFunction(scheduler)) throw new Error('Invalid actions or scheduler');

  // store the server config
  this._options = options;
  this._actions = actions;
  this._scheduler = scheduler;
  this._lib = lib;
  this._state = OFFLINE;
  this._host = host;
  this._port = Number(port);
  this._server = this._host + ':' + this._port;
  this.running = {};

  // get the global settings
  this.getSettings().then(function (settings) {
    _this._appName = settings.appName;
    _this._checkinFrequency = settings.checkinFrequency;
    _this._offlineAfterPolls = settings.offlineAfterPolls;
    _this._offlineAfter = _this._checkinFrequency * _this._offlineAfterPolls;

    // set up logging
    var logConfig = getLogConfig(_this._appName, loglevel, logfile);
    _this._logger = logConfig.level !== LOG_LEVELS.silent ? bunyan.createLogger(logConfig) : false;

    // log startup
    _this.logInfo('Starting [' + _this._appName + '] server on ' + _this._server);

    // get the current nodes config
    return _this.getSelf().then(function (self) {
      _this.id = _this._id = self.id;
      _this._state = self.state === MAINTENANCE ? MAINTENANCE : ONLINE;
      return _this.checkin(true).then(function () {

        // set up socket.io server
        _this._app = http.createServer(function (req, res) {
          res.writeHead(200);
          res.end('' + _this._server);
        });
        _this._app.listen(port);
        _this._io = new SocketServer(_this._app);

        // if the state is online start the listeners
        if (_this._state === ONLINE) _this.startListeners();
      });
    });
  }).catch(function (err) {
    _this._logger ? _this.logFatal(err) : console.error(err);
    process.exit();
  });
}

// server methods
Server.prototype.checkin = checkin;
Server.prototype.getSelf = getSelf;
Server.prototype.getSettings = getSettings;
Server.prototype.schedule = schedule;
Server.prototype.run = run;
Server.prototype.stop = stop;
Server.prototype.startListeners = startListeners;
Server.prototype.info = function () {
  return {
    id: this._id,
    host: this._host,
    port: this._port,
    state: this._state,
    running: this.running
  };
};

// logging prototypes
Server.prototype.logFatal = function (msg) {
  var obj = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

  if (this._logger) this._logger.fatal(_.merge(obj, { server: this._server }), msg);
};
Server.prototype.logError = function (msg) {
  var obj = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

  if (this._logger) this._logger.error(_.merge(obj, { server: this._server }), msg);
};
Server.prototype.logWarn = function (msg) {
  var obj = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

  if (this._logger) this._logger.warn(_.merge(obj, { server: this._server }), msg);
};
Server.prototype.logInfo = function (msg) {
  var obj = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

  if (this._logger) this._logger.info(_.merge(obj, { server: this._server }), msg);
};
Server.prototype.logDebug = function (msg) {
  var obj = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

  if (this._logger) this._logger.debug(_.merge(obj, { server: this._server }), msg);
};
Server.prototype.logTrace = function (msg) {
  var obj = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

  if (this._logger) this._logger.trace(_.merge(obj, { server: this._server }), msg);
};

var DEFAULT_HTTP_PORT = 8080;

function pretty(obj, path) {
  obj = _.get(obj, path, obj);
  return JSON.stringify(obj, null, '  ');
}

function makeError(options, canTerminate) {
  return function (msg) {
    var showHelp = arguments.length <= 1 || arguments[1] === undefined ? false : arguments[1];
    var terminate = arguments.length <= 2 || arguments[2] === undefined ? true : arguments[2];

    console.error(chalk.red('ERROR:', msg));
    if (showHelp && options.showHelp) options.showHelp();
    if (terminate && canTerminate) process.exit();
  };
}

function start (lib, helper, actions, scheduler) {
  var error = helper.error;
  var options = helper.options;
  var backend = helper.backend;

  if (!options || !_.has(options, 'options')) return error('Invalid options');
  var _options$options = options.options;
  var host = _options$options.host;
  var port = _options$options.port;

  helper.options.options.port = port || DEFAULT_HTTP_PORT;
  if (!host) return error('No host option was specified', true);
  return new Server(backend, lib, helper.options.options, actions, scheduler);
}

var toObjectString = factory.utils.toObjectString;


function stop$1(lib, helper) {
  var error = helper.error;
  var options = helper.options;

  var opts = options.options;
  if (!opts) return error('No options specified');

  var args = _.trim(_.trim(toObjectString(opts), '{'), '}');

  return lib.Runner('{\n    readRunner (' + args + ') { id, host, port }\n  }').then(function (result) {
    var runner = _.get(result, 'data.readRunner[0]');
    if (result.errors || !runner) return error(result.errors || 'Could not find runner');

    var socket = SocketClient('http://' + runner.host + ':' + runner.port, { timeout: 2000 });
    socket.on('connected', function () {
      return socket.emit('stop');
    });
    socket.on('ok', function (data) {
      socket.emit('ok');
      socket.emit('disconnect');
      process.exit();
    });
    socket.on('connect_error', function () {
      return error('Socket connection error, the runner may not be listening');
    });
    socket.on('connect_timeout', function () {
      return error('Socket connection timeout, the runner may not be listening');
    });
  }).catch(function (err) {
    return error;
  });
}

function list(type, lib, helper) {
  var error = helper.error;
  var pretty = helper.pretty;
  var options = helper.options;


  if (type === 'runner') {
    var args = '';
    if (options.options) {
      var _options$options = options.options;
      var id = _options$options.id;
      var host = _options$options.host;
      var port = _options$options.port;
      var state = _options$options.state;
      var zone = _options$options.zone;

      if (id) {
        args = '(id: "' + id + '")';
      } else if (state) {
        args = '(state: ' + state + ')';
      } else if (zone) {
        args = '(zone: "' + zone + '")';
      } else if (host || port) {
        var hp = [];
        if (host) hp.push('host: "' + host + '"');
        if (port) hp.push('port: ' + port);
        args = '(' + hp.join(', ') + ')';
      }
    }

    return lib.Runner('{ readRunner ' + args + ' { id, host, port, zone { id, name, description, metadata }, state, checkin, metadata } }').then(function (res) {
      if (res.errors) return error(pretty(res.errors));
      console.log(chalk.blue.bold('Runner Nodes:'));
      console.log(chalk.blue(pretty(res.data.readRunner)));
      process.exit();
    }).catch(error);
  } else if (type === 'zone') {
    return lib.Runner('{ readZone { id, name, description, metadata } }').then(function (res) {
      if (res.errors) return error(pretty(res.errors));
      console.log(chalk.blue.bold('Runner Zones:'));
      console.log(chalk.blue(pretty(res.data.readZone)));
      process.exit();
    }).catch(error);
  } else if (type === 'queue') {
    return lib.Runner('{ readQueue { id, created, updated, runner, state, forwarded, action, context } }').then(function (res) {
      if (res.errors) return error(pretty(res.errors));
      console.log(chalk.blue.bold('Runner Queue:'));
      console.log(chalk.blue(pretty(res.data.readQueue)));
      process.exit();
    }).catch(error);
  } else if (type === 'settings') {
    return lib.Runner('{ readSettings { appName, checkinFrequency, offlineAfterPolls } }').then(function (res) {
      if (res.errors) return error(pretty(res.errors));
      console.log(chalk.blue.bold('Runner Global Settings:'));
      console.log(chalk.blue(pretty(res.data.readSettings)));
      process.exit();
    }).catch(error);
  }
}

function status (lib, helper) {
  var error = helper.error;
  var pretty = helper.pretty;
  var options = helper.options;
  var _options$options = options.options;
  var id = _options$options.id;
  var host = _options$options.host;
  var port = _options$options.port;


  var args = '';
  if (id) args = 'id: "' + id + '"';else if (host && port) args = 'host: "' + host + '", port: ' + port;else return error('Status check requires either a valid ID or hostname, port combo');

  return lib.Runner('{ readRunner (' + args + ') { id, host, port } }').then(function (res) {
    var nodeInfo = _.get(res, 'data.readRunner[0]');
    if (res.errors) return error(pretty(res.errors));
    if (!nodeInfo) return error('Runner not found');
    var socket = SocketClient('http://' + nodeInfo.host + ':' + nodeInfo.port, { timeout: 2000 });
    socket.on('connected', function () {
      return socket.emit('status');
    });
    socket.on('status', function (data) {
      socket.emit('disconnect');
      console.log(chalk.blue.bold('Node Status:'));
      console.log(chalk.blue(pretty(data)));
      process.exit();
    });
    socket.on('connect_error', function () {
      return error('Socket connection error, the runner may not be listening');
    });
    socket.on('connect_timeout', function () {
      return error('Socket connection timeout, the runner may not be listening');
    });
  }).catch(error);
}

function schedule$1 (lib, helper) {
  var resolveArgs = new Promise(function (resolve, reject) {
    var error = helper.error;
    var pretty = helper.pretty;
    var options = helper.options;
    var terminate = helper.terminate;
    var _options$options = options.options;
    var id = _options$options.id;
    var host = _options$options.host;
    var port = _options$options.port;
    var action = _options$options.action;
    var context = _options$options.context;

    context = context || {};
    var args = '';
    if (id) args = 'id: "' + id + '"';else if (host && port) args = 'host: "' + host + '", port: ' + port;else return reject('Schedule requires either a valid ID or hostname, port combo');
    if (!action) return reject('No action specified');
    return resolve({ args: args, context: context, pretty: pretty, action: action, terminate: terminate });
  });

  return resolveArgs.then(function (_ref) {
    var args = _ref.args;
    var context = _ref.context;
    var pretty = _ref.pretty;
    var action = _ref.action;
    var terminate = _ref.terminate;

    var timeout = 2000;
    return lib.Runner('{ readRunner (' + args + ') { id, host, port } }').then(function (res) {
      return new Promise(function (resolve, reject) {
        var disconnected = false;
        var nodeInfo = _.get(res, 'data.readRunner[0]');
        if (res.errors) return reject(pretty(res.errors));
        if (!nodeInfo) return reject('Runner not found');

        var uri = 'http://' + nodeInfo.host + ':' + nodeInfo.port;
        var socket = SocketClient(uri, { timeout: timeout });

        setTimeout(function () {
          if (!disconnected) {
            socket.emit('disconnect');
            socket.disconnect(0);
            reject('Fallback timeout reached');
            if (terminate) process.exit();
          }
        }, timeout);

        socket.on('connected', function () {
          socket.emit('schedule', { action: action, context: context });
        });

        socket.on('schedule.accept', function () {
          disconnected = true;
          socket.emit('disconnect');
          socket.disconnect(0);
          resolve('Accepted schedule request');
          if (terminate) process.exit();
        });

        socket.on('schedule.error', function (err) {
          disconnected = true;
          socket.emit('disconnect');
          socket.disconnect(0);
          reject(err);
          if (terminate) process.exit();
        });

        socket.on('connect_error', function () {
          socket.emit('disconnect');
          disconnected = true;
          socket.disconnect(0);
          reject('Schedule error');
          if (terminate) process.exit();
        });
        socket.on('connect_timeout', function () {
          disconnected = true;
          socket.emit('disconnect');
          socket.disconnect(0);
          reject('Schedule error');
          if (terminate) process.exit();
        });
      });
    });
  });
  //.catch(error)
}

/*
 * yellowjacket command line builder
 *
 * This module exports a function that expects a yellowjacket backend as its first argument
 * optionally if you do not want to use the cli an options hash can be passed as the second argument
 *
 */
function index (backend, options, actions, scheduler) {
  var terminate = !_.isObject(options);
  options = options || getOptions();
  var error = makeError(options, terminate);

  if (!backend) error('A backend is required but was not supplied');

  var lib = gql(backend);
  var helper = { options: options, error: error, pretty: pretty, terminate: terminate, backend: backend };

  switch (options.target) {
    case 'runner':
      if (options.action === 'list') return list(options.target, lib, helper);
      if (options.action === 'add') return add(lib, helper);
      if (options.action === 'start') return start(lib, helper, actions, scheduler);
      if (options.action === 'status') return status(lib, helper);
      if (options.action === 'stop') return stop$1(lib, helper);
      if (options.action === 'schedule') return schedule$1(lib, helper);
      return error('Invalid ' + options.target + ' options', true);
    case 'zone':
      if (options.options && options.options.list) return list(options.target, lib, helper);
      return error('Invalid ' + options.target + ' options', true);
    case 'queue':
      if (options.options && options.options.list) return list(options.target, lib, helper);
      return error('Invalid ' + options.target + ' options', true);
    case 'settings':
      if (options.options && options.options.list) return list(options.target, lib, helper);
      return error('Invalid ' + options.target + ' options', true);
    default:
      error('Invalid options', true);
  }
}

module.exports = index;