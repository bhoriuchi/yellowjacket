import _ from 'lodash'
import chalk from 'chalk'

export default function (lib, helper) {
  let { error, pretty, options: { host, port, role } } = helper

  let args = []
  if (!host) error('Add operation requires a host option')
  if (port) args.push(`port: ${port}`)
  args.push(`host: "${host}"`)

  lib.Runner(`mutation Mutation {
  createRunner (
    ${args.join(', ')}
  ) {
    id,
    host,
    port,
    state,
    metadata
  }
}`)
    .then((res) => {
      if (res.errors) return error(pretty(_.get(res, 'errors[0].message', res.errors)))
      console.log(chalk.green.bold('Added Node:'))
      console.log(chalk.green(pretty(res, 'data.createRunner')))
      process.exit()
    })
    .catch(error)
}