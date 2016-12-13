# yellowjacket
Scalable task runner

### Prerequisites
* [`graphql`](https://www.npmjs.com/package/graphql)
* Backend (currently only rethinkdb is included)

### Notes
* current documentation has been quickly thrown together and will improve with future releases
* **Load balancing** tested with a simple [NGINX configuration](https://github.com/bhoriuchi/yellowjacket/blob/master/example/nginx.conf)

### Example

Simple hello world with a rethinkdb backend

**ES6**

##### Setup yellowjacket
```js
import * as graphql from 'graphql'
import rethinkdbdash from 'rethinkdbdash'
import { rethinkdb as RethinkDBBackend } from 'yellowjacket/backend'
import yellowjacket from 'yellowjacket'
import installer from 'yellowjacket/install'
let backend = new RethinkDBBackend(rethinkdbdash({ silent: true }), graphql)

// scheduler: takes a node list in and returns a prioritized list
// of acceptable runners via done callback
let scheduler = function (runner, nodeList, queue, done) {
  return done(null, [ runner.info() ]) // schedule on the current runner
}

// actions: list of actions that can be completed. returns potential status
// in done callback or defaults to SUCCESS
let actions = {
  print (runner, task, done) {
    console.log(JSON.stringify(task.context))
    done()
  }
}
```

##### If installing
```js
installer(backend)
```

##### If using as a command line
```js
yellowjacket(backend, undefined, actions, scheduler)
```

##### If using as a function call
```js
let command = {
    target: 'runner',
    action: 'start',
    options: {
      host: 'localhost',
      port: 8080
    }
}

yellowjacket(backend, command, actions, scheduler)
```

### Commands

Commands are constructed by creating an object with the following structure

```js
{
  target: 'targetName',
  action: 'actionName',
  options: {
    optionName: optionValue,
    ...
  }
}
```

#### targets

##### `runner`

**actions**

* `add`
  **options**
  * `host` {`String`} - hostname or IP accessible by other nodes
  * `port` {`Int`} - port to listen on
* `start`
  * `host` {`String`} - host name or IP the runner was added with
  * `port` {`Int`} - port the runner was added with
  * `loglevel`: {`LogLevelEnum`} - Level of logging
  * `logfile`: {`String`} - Path to a log file
* `stop` - host/port combo or ID
  * `id` {`String`} - runner ID
  * `host` {`String`} - host name or IP the runner was added with
  * `port` {`Int`} - port the runner was added with
* `list` - no options lists all runners
  * `host` {`String`} - list runners with host
  * `port` {`Int`} - list runners with port
  * `state` {`RunnerStateEnum`} - list runner with state
  * `zone` {`String`} - list runner that belongs to zone with ID

**CLI Examples**
```
> cli runner add host localhost port 8080
> cli runner list
> cli runner start host localhost port 8080
> cli runner stop host localhost port 8080
```


##### `zone`

**options**
  * `list` - lists all zones

##### `queue`

**options**
  * `list` - lists all queued tasks

##### `settings`

**options**
  * `list` - lists all settings

---

#### types

**LogLevelEnum**

```js
"silent" | "fatal" | "error" | "warn" | "info" | "debug" | "trace"
```

**RunnerStateEnum**
```js
"ONLINE" | "OFFLINE" | "MAINTENANCE" | "UNKNOWN"
```
