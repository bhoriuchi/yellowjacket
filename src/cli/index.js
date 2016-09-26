import getOptions from './options'
import { YellowJacketServer } from '../server/index'

export default function cli (config, parser) {
  let options = getOptions(config, parser)
  this.cmd(options)
    .then((result) => {
      if (!(result instanceof YellowJacketServer)) {
        try {
          console.log(JSON.stringify(result, null, '  '))
        } catch (err) {
          console.log(result)
        }
        process.exit()
      }
    })
    .catch((error) => {
      if (!(error instanceof YellowJacketServer)) {
        console.error(error.message)
        process.exit()
      }
    })
}