import StateEnum from '../../graphql/types/RunnerNodeStateEnum'
let { OFFLINE, MAINTENANCE } = StateEnum.values

export default function (backend) {
  return function (source, args, context, info) {
    let { util, filter } = backend

    return util.exec(util.update('RunnerNode', {
      checkin: util.now(),
      state: args.state
    }))
  }
}