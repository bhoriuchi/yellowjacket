import getOptions from './options'
import YellowjacketServer from '../server/index'

export default function cli (config, parser) {
  let options = getOptions(config, parser)
  this.cmd(options)
    .then((result) => {
      if (!(result instanceof YellowjacketServer)) {
        try {
          console.log(JSON.stringify(result, null, '  '))
        } catch (err) {
          console.log(result)
        }
        process.exit()
      }
    })
    .catch((error) => {
      if (!(error instanceof YellowjacketServer)) {
        console.error(error.message)
        process.exit()
      }
    })
}