export default {
  fields: {
    id: {
      type: 'String'
    },
    appName: {
      description: 'Name used for application logs',
      type: 'String'
    },
    checkinFrequency: {
      description: 'Time in seconds between runner checkins',
      type: 'Int'
    },
    offlineAfterPolls: {
      description: 'Number of checkins that can be missed before marking the runner offline',
      type: 'Int'
    }
  }
}