import path from 'path'
import yellowjacket from '../src/index'
import localdown from 'localdown'

yellowjacket.createWorker({
  port: 8080,
  dbPath: path.resolve(__dirname + '/localdata')
}, localdown)