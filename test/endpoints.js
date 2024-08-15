process.env.NODE_ENV = 'test'

const { promisify } = require('util')
var test = require('ava')
var servertest = require('servertest')

var server = require('../lib/server')
const client = require('../lib/redis')

test.beforeEach(async () => {
  await cleanup()
})

const delAsync = promisify(client.del).bind(client)
const keysAsync = promisify(client.keys).bind(client)

async function cleanup () {
  try {
    await delAsync('targets')
    const geoStateKeys = await keysAsync('geoState:*')
    if (geoStateKeys.length > 0) {
      await delAsync(geoStateKeys)
    }

    const hourKeys = await keysAsync('hour:*')
    if (hourKeys.length > 0) {
      await delAsync(hourKeys)
    }

    const targetAcceptsKeys = await keysAsync('target:*:accepts:*')
    if (targetAcceptsKeys.length > 0) {
      await delAsync(targetAcceptsKeys)
    }
  } catch (err) {}
}

test.serial.cb('healthcheck', function (t) {
  var url = '/health'
  servertest(server(), url, { encoding: 'json' }, function (err, res) {
    t.falsy(err, 'no error')

    t.is(res.statusCode, 200, 'correct statusCode')
    t.is(res.body.status, 'OK', 'status is ok')
    t.end()
  })
})

test.serial.cb('addNewTarget - create new target happy path', function (t) {
  const url = '/api/targets'
  const newTarget = {
    id: '1',
    url: 'http://example.com',
    value: '0.50',
    maxAcceptsPerDay: '10',
    accept: {
      geoState: {
        $in: ['ca', 'ny']
      },
      hour: {
        $in: ['13', '14', '15']
      }
    }
  }

  servertest(server(), url, { encoding: 'json', method: 'POST' }, function (err, res) {
    const { statusCode, body } = res
    const { message, target: createdTarget } = body
    t.falsy(err, 'no error')
    t.is(statusCode, 200, 'correct statusCode')
    t.is(message, 'new target created successfully', 'target created')
    t.deepEqual(newTarget, createdTarget, 'target value is correct')
    t.end()
  }).end(JSON.stringify(newTarget))
})

test.serial.cb('addNewTarget - bad request body', function (t) {
  const url = '/api/targets'
  const badRequestBody = {}

  servertest(server(), url, { encoding: 'json', method: 'POST' }, function (err, res) {
    t.falsy(err, 'no error')
    t.is(res.statusCode, 400, 'correct statusCode for bad request')
    t.is(res.body.error, 'Bad Request', 'correct error message')
    t.end()
  }).end(JSON.stringify(badRequestBody))
})

test.serial.cb('addNewTarget - prevent adding duplicate target ID', function (t) {
  const url = '/api/targets'
  const newTarget = {
    id: '1',
    url: 'http://example.com',
    value: '0.50',
    maxAcceptsPerDay: '10',
    accept: {
      geoState: {
        $in: ['ca', 'ny']
      },
      hour: {
        $in: ['13', '14', '15']
      }
    }
  }

  servertest(server(), url, { encoding: 'json', method: 'POST' }, function (err, res) {
    t.falsy(err, 'no error on first add')
    t.is(res.statusCode, 200, 'correct statusCode on first add')

    servertest(server(), url, { encoding: 'json', method: 'POST' }, function (err, res) {
      t.falsy(err, 'no error on second add')
      t.is(res.statusCode, 409, 'correct statusCode on second add')
      t.is(res.body.error, 'Conflict', 'correct error message')
      t.end()
    }).end(JSON.stringify(newTarget))
  }).end(JSON.stringify(newTarget))
})

test.serial.cb('getAllTargets - retrieve all targets with no targets available', function (t) {
  const url = '/api/targets'

  servertest(server(), url, { encoding: 'json', method: 'GET' }, function (err, res) {
    t.falsy(err, 'no error')
    t.is(res.statusCode, 200, 'correct statusCode')
    t.true(Array.isArray(res.body), 'response is an array')
    t.is(res.body.length, 0, 'there are no targets')
    t.end()
  })
})

test.serial.cb('getAllTargets - retrieve all targets with 1 target available', function (t) {
  const url = '/api/targets'
  const newTarget = {
    id: '1',
    url: 'http://example.com',
    value: '0.50',
    maxAcceptsPerDay: '10',
    accept: {
      geoState: {
        $in: ['ca', 'ny']
      },
      hour: {
        $in: ['13', '14', '15']
      }
    }
  }

  servertest(server(), url, { encoding: 'json', method: 'POST' }, function (err, res) {
    const { statusCode, body } = res
    const { message, target: createdTarget } = body
    t.falsy(err, 'no error')
    t.is(statusCode, 200, 'correct statusCode')
    t.is(message, 'new target created successfully', 'target created')
    t.deepEqual(newTarget, createdTarget, 'target value is correct')

    servertest(server(), url, { encoding: 'json', method: 'GET' }, function (err, res) {
      t.falsy(err, 'no error')
      t.is(res.statusCode, 200, 'correct statusCode')
      t.true(Array.isArray(res.body), 'response is an array')
      t.is(res.body.length, 1, 'there is one target available')
      t.end()
    })
  }).end(JSON.stringify(newTarget))
})

test.serial.cb('getTargetById - retrieve a single target', function (t) {
  const createUrl = '/api/targets'
  const newTarget = {
    id: '1',
    url: 'http://example.com',
    value: '0.50',
    maxAcceptsPerDay: '10',
    accept: {
      geoState: {
        $in: ['ca', 'ny']
      },
      hour: {
        $in: ['13', '14', '15']
      }
    }
  }

  servertest(server(), createUrl, { encoding: 'json', method: 'POST' }, function (err, createdRes) {
    const { statusCode: createdStatusCode, body: createdBody } = createdRes
    const { message: createdMessage, target: createdTarget } = createdBody

    t.falsy(err, 'no error')
    t.is(createdStatusCode, 200, 'correct statusCode')
    t.is(createdMessage, 'new target created successfully', 'target created')
    t.deepEqual(newTarget, createdTarget, 'target value is correct')

    const targetId = newTarget.id
    const getUrl = `/api/target/${targetId}`

    servertest(server(), getUrl, { encoding: 'json', method: 'GET' }, function (err, res) {
      t.falsy(err, 'no error')
      t.is(res.statusCode, 200, 'correct statusCode')
      t.deepEqual(newTarget, res.body, 'correct target retrieved')
      t.end()
    })
  }).end(JSON.stringify(newTarget))
})

test.serial.cb('updateTargetById - update an existing target', function (t) {
  const createUrl = '/api/targets'
  const newTarget = {
    id: '1',
    url: 'http://example.com',
    value: '0.50',
    maxAcceptsPerDay: '10',
    accept: {
      geoState: {
        $in: ['ca', 'ny']
      },
      hour: {
        $in: ['13', '14', '15']
      }
    }
  }

  servertest(server(), createUrl, { encoding: 'json', method: 'POST' }, function (err, createdRes) {
    const { statusCode: createdStatusCode, body: createdBody } = createdRes
    const { message: createdMessage, target: createdTarget } = createdBody

    t.falsy(err, 'no error')
    t.is(createdStatusCode, 200, 'correct statusCode')
    t.is(createdMessage, 'new target created successfully', 'target created')
    t.deepEqual(newTarget, createdTarget, 'target value is correct')

    const targetToUpdateId = newTarget.id
    const updateUrl = `/api/target/${targetToUpdateId}`
    const targetUpdateBody = { ...newTarget, maxAcceptsPerDay: '20' }

    servertest(server(), updateUrl, { encoding: 'json', method: 'POST' }, function (err, res) {
      t.falsy(err, 'no error')
      t.is(res.statusCode, 200, 'correct statusCode')
      t.is(res.body.message, 'target updated successfully', 'target updated')
      t.is(res.body.target.maxAcceptsPerDay, '20', 'target maxAcceptsPerDay updated')
      t.end()
    }).end(JSON.stringify(targetUpdateBody))
  }).end(JSON.stringify(newTarget))
})

test.serial.cb('updateTargetById - prevent updating with bad request body', function (t) {
  const createUrl = '/api/targets'
  const newTarget = {
    id: '1',
    url: 'http://example.com',
    value: '0.50',
    maxAcceptsPerDay: '10',
    accept: {
      geoState: {
        $in: ['ca', 'ny']
      },
      hour: {
        $in: ['13', '14', '15']
      }
    }
  }

  servertest(server(), createUrl, { encoding: 'json', method: 'POST' }, function (err, createdRes) {
    const { statusCode: createdStatusCode, body: createdBody } = createdRes
    const { message: createdMessage, target: createdTarget } = createdBody

    t.falsy(err, 'no error')
    t.is(createdStatusCode, 200, 'correct statusCode')
    t.is(createdMessage, 'new target created successfully', 'target created')
    t.deepEqual(newTarget, createdTarget, 'target value is correct')

    const targetToUpdateId = newTarget.id
    const updateUrl = `/api/target/${targetToUpdateId}`
    const targetUpdateBody = { id: null }

    servertest(server(), updateUrl, { encoding: 'json', method: 'POST' }, function (err, res) {
      t.falsy(err, 'no error')
      t.is(res.statusCode, 400, 'correct statusCode')
      t.is(res.body.error, 'Bad Request', 'correct error message')
      t.end()
    }).end(JSON.stringify(targetUpdateBody))
  }).end(JSON.stringify(newTarget))
})

test.serial.cb('updateTargetById - prevent updating when ids do not match', function (t) {
  const targetToUpdateId = '1'
  const updateUrl = `/api/target/${targetToUpdateId}`
  const targetUpdateBody = {
    id: '2',
    url: 'http://example.com',
    value: '0.50',
    maxAcceptsPerDay: '10',
    accept: {
      geoState: {
        $in: ['ca', 'ny']
      },
      hour: {
        $in: ['13', '14', '15']
      }
    }
  }

  servertest(server(), updateUrl, { encoding: 'json', method: 'POST' }, function (err, res) {
    t.falsy(err, 'no error')
    t.is(res.statusCode, 400, 'correct statusCode')
    t.is(res.body.error, 'Bad Request', 'correct error message')
    t.end()
  }).end(JSON.stringify(targetUpdateBody))
})

test.serial.cb('updateTargetById - prevent updating non existing target', function (t) {
  const targetToUpdateId = '1'
  const updateUrl = `/api/target/${targetToUpdateId}`
  const targetUpdateBody = {
    id: '1',
    url: 'http://example.com',
    value: '0.50',
    maxAcceptsPerDay: '10',
    accept: {
      geoState: {
        $in: ['ca', 'ny']
      },
      hour: {
        $in: ['13', '14', '15']
      }
    }
  }

  servertest(server(), updateUrl, { encoding: 'json', method: 'POST' }, function (err, res) {
    t.falsy(err, 'no error')
    t.is(res.statusCode, 404, 'correct statusCode')
    t.is(res.body.error, 'Not Found', 'correct error message')
    t.end()
  }).end(JSON.stringify(targetUpdateBody))
})

test.serial.cb('getVisitorDecision - get decision with invalid visitor data', function (t) {
  const url = '/route'
  const visitorData = {}

  servertest(server(), url, { encoding: 'json', method: 'POST' }, function (err, res) {
    t.falsy(err, 'no error')
    t.is(res.statusCode, 400, 'correct statusCode')
    t.is(res.body.error, 'Bad Request', 'correct error message')
    t.end()
  }).end(JSON.stringify(visitorData))
})

test.serial.cb('getVisitorDecision - correct decision based on targets', function (t) {
  const createUrl = '/api/targets'
  const decisionUrl = '/route'

  const visitorData = {
    geoState: 'ny',
    publisher: 'abc',
    timestamp: '2018-07-13T18:28:59.513Z'
  }

  const baseTarget = {
    id: '1',
    url: 'target1.com',
    value: '0.80',
    maxAcceptsPerDay: '0',
    accept: {
      geoState: {
        $in: ['ny']
      },
      hour: {
        $in: ['18']
      }
    }
  }

  const targets = [
    { ...baseTarget },
    {
      ...baseTarget,
      id: '2',
      url: 'target2.com',
      maxAcceptsPerDay: '10',
      accept: {
        hour: { $in: ['22'] },
        geoState: { $in: ['ca'] }
      }
    },
    {
      ...baseTarget,
      id: '3',
      url: 'target3.com',
      maxAcceptsPerDay: '10',
      value: '1.3'
    },
    {
      ...baseTarget,
      id: '4',
      url: 'target4.com',
      maxAcceptsPerDay: '10',
      value: '2.4'
    }
  ]

  const createTargetPromises = targets.map(target =>
    new Promise((resolve, reject) => {
      servertest(
        server(),
        createUrl, { encoding: 'json', method: 'POST' },
        (err, res) => {
          if (err) return reject(err)
          t.is(res.statusCode, 200, 'Target created successfully')
          resolve()
        }).end(JSON.stringify(target))
    })
  )

  Promise.all(createTargetPromises)
    .then(() => {
      servertest(server(), decisionUrl, { encoding: 'json', method: 'POST' }, function (err, res) {
        t.falsy(err, 'no error on decision request')
        t.is(res.statusCode, 200, 'correct statusCode for decision request')
        t.is(res.body.url, 'target4.com', 'correct target chosen based on highest value')
        t.end()
      }).end(JSON.stringify(visitorData))
    })
    .catch(() => {})
})
