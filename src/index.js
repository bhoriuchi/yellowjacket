import rethinkdb from './backend/rethinkdb/index'
import { YellowjacketRethinkDBBackend } from './backend/rethinkdb/index'
import client from './client/index'
import { YellowjacketClient } from './client/index'
import server from './server/index'
import YellowjacketServer from './server/index'

export { rethinkdb }
export { YellowjacketRethinkDBBackend }

export default {
  rethinkdb,
  YellowjacketRethinkDBBackend,
  client,
  YellowjacketClient,
  server,
  YellowjacketServer
}