import chalk from 'chalk'

export default function list (type, lib, helper) {
  let { error, pretty, options } = helper

  if (type === 'runner') {
    let args = ''
    if (options.options) {
      let { id, host, port, state, zone } = options.options
      if (id) {
        args = `(id: "${id}")`
      } else if (state) {
        args = `(state: ${state})`
      } else if (zone) {
        args = `(zone: "${zone}")`
      } else if (host || port) {
        let hp = []
        if (host) hp.push(`host: "${host}"`)
        if (port) hp.push(`port: ${port}`)
        args = `(${hp.join(', ')})`
      }
    }

    return lib.Runner(`{ readRunner ${args} { id, host, port, zone { id, name, description, metadata }, state, metadata } }`)
      .then((res) => {
        if (res.errors) return error(pretty(res.errors))
        console.log(chalk.blue.bold('Runner Nodes:'))
        console.log(chalk.blue(pretty(res.data.readRunner)))
        process.exit()
      })
      .catch(error)
  } else if (type === 'zone') {
    return lib.Runner('{ readZone { id, name, description, metadata } }')
      .then((res) => {
        if (res.errors) return error(pretty(res.errors))
        console.log(chalk.blue.bold('Runner Zones:'))
        console.log(chalk.blue(pretty(res.data.readZone)))
        process.exit()
      })
      .catch(error)
  } else if (type === 'queue') {
    return lib.Runner('{ readQueue { id, created, updated, runner, state, forwarded, action, context } }')
      .then((res) => {
        if (res.errors) return error(pretty(res.errors))
        console.log(chalk.blue.bold('Runner Queue:'))
        console.log(chalk.blue(pretty(res.data.readQueue)))
        process.exit()
      })
      .catch(error)
  } else if (type === 'settings') {
    return lib.Runner('{ readSettings { appName, checkinFrequency, offlineAfterPolls } }')
      .then((res) => {
        if (res.errors) return error(pretty(res.errors))
        console.log(chalk.blue.bold('Runner Global Settings:'))
        console.log(chalk.blue(pretty(res.data.readSettings)))
        process.exit()
      })
      .catch(error)
  }
}