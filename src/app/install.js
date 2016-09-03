import chalk from 'chalk'

export default function (backend) {
  return backend.install({
    RunnerSettings: [
      {
        appName: 'YELLOWJACKET',
        checkinFrequency: 30,
        offlineAfterPolls: 1
      }
    ],
    RunnerZone: [
      {
        id: '32f2eb22-e793-44f9-a942-826dc5ed2c52',
        name: 'US Test',
        description: 'Testing zone',
        metadata: {
          facts: ['US', 'TEST']
        }
      }
    ]
  }).then(function (res) {
    console.log(chalk.blue('Install Summary'))
    console.log(chalk.blue(JSON.stringify(res, null, '  ')))
    process.exit()
  }).catch(function (err) {
    console.error(chalk.red(err))
    process.exit()
  })
}