var URL = require('url')
var http = require('http')
var cuid = require('cuid')
var Corsify = require('corsify')
var sendJson = require('send-data/json')
var ReqLogger = require('req-logger')
var healthPoint = require('healthpoint')
var HttpHashRouter = require('http-hash-router')

var redis = require('./redis')
var version = require('../package.json').version
var controller = require('./controller')

var router = HttpHashRouter()
var logger = ReqLogger({ version: version })
var health = healthPoint({ version: version }, redis.healthCheck)
var cors = Corsify({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, accept, content-type'
})

setRoute('/favicon.ico', empty)

setRoute('/api/targets', {
  POST: controller.addNewTarget,
  GET: controller.getAllTargets
})

setRoute('/api/target/:id', {
  GET: controller.getTargetById,
  POST: controller.updateTargetById
})

setRoute('/route', { POST: controller.getVisitorDecision })

module.exports = function createServer () {
  return http.createServer(cors(handler))
}

function handler (req, res) {
  if (req.url === '/health') return health(req, res)
  req.id = cuid()
  logger(req, res, { requestId: req.id }, function (info) {
    info.authEmail = (req.auth || {}).email
    console.log(info)
  })

  bodyParser(req, res, () => (
    router(
      req,
      res,
      { query: getQuery(req.url) },
      onError.bind(null, req, res)
    )
  ))
}

function bodyParser (req, res, next) {
  let body = ''

  req.on('data', chunk => (body += chunk.toString()))
  req.on('end', end)

  function end () {
    try {
      req.body = body ? JSON.parse(body) : {}
      next()
    } catch (err) {
      res.writeHead(400)
      res.end()
    }
  }
}

function setRoute (path, handlers) {
  router.set(path, (req, res, opts) => {
    const method = req.method
    const respond = ((req, res) => body => (
      sendJson(req, res, body)
    ))(req, res)

    if (typeof handlers === 'function') {
      handlers = { GET: handlers }
    }

    if (handlers[method]) {
      return handlers[method]({
        req,
        respond,
        opts,
        callback: onError.bind(null, req, res)
      })
    }

    onError(
      req,
      res,
      Object.assign(new Error(), { statusCode: 405 })
    )
  })
}

function onError (req, res, err) {
  if (!err) return

  res.statusCode = err.statusCode || 500
  logError(req, res, err)

  sendJson(req, res, {
    error: err.message || http.STATUS_CODES[res.statusCode]
  })
}

function logError (req, res, err) {
  if (process.env.NODE_ENV === 'test') return

  var logType = res.statusCode >= 500 ? 'error' : 'warn'

  console[logType]({
    err: err,
    requestId: req.id,
    statusCode: res.statusCode
  }, err.message)
}

function empty (req, res) {
  res.writeHead(204)
  res.end()
}

function getQuery (url) {
  return URL.parse(url, true).query // eslint-disable-line
}
