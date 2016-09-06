export const DEFAULT_TABLES = {
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
}


// create a table
export function createTable (dbc, name) {
  return dbc.tableCreate(name)
    .run()
    .then(() => `${name} Created`)
    .catch((err) => {
      if (err.msg.match(/^Table.*already\s+exists\.$/i) !== null) return `${name} Exists`
      throw err
    })
}

export function now (backend) {
  return function () {
    return backend._r.now().run(backend._connection)
  }
}

export default {
  DEFAULT_TABLES,
  createTable,
  now
}