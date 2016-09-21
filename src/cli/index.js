import getOptions from './options'

export default function cli (config, parser) {
  let options = getOptions(config, parser)
  this.cmd(options)
    .then((result) => {
      try {
        console.log(JSON.stringify(result, null, '  '))
      } catch (err) {
        console.log(result)
      }
      process.exit()
    })
    .catch((error) => {
      console.error(error.message)
      process.exit()
    })
}