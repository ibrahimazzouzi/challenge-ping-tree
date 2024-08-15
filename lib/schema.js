module.exports = {
  targetSchema: {
    id: 'string',
    url: 'string',
    value: 'string',
    maxAcceptsPerDay: 'string',
    accept: {
      geoState: { $in: 'array' },
      hour: { $in: 'array' }
    }
  },
  visitorSchema: {
    geoState: 'string',
    publisher: 'string',
    timestamp: 'string'
  }
}
