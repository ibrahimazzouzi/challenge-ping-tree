const util = require('util')
const client = require('./redis')
const {
  addTargetGeoStateAndHour,
  filterTargetsByGeoStateAndHour,
  addTargetDailyAcceptCount,
  filterTargetsByDailyAccepts,
  chooseTargetWithHighestValue,
  updateTargetGeoStateAndHour
} = require('./utils')

module.exports = {
  addOneTarget,
  getAllTargets,
  getTargetById,
  updateTargetById,
  getVisitorDecision
}

const hsetAsync = util.promisify(client.hset).bind(client)
const hgetallAsync = util.promisify(client.hgetall).bind(client)
const hgetAsync = util.promisify(client.hget).bind(client)
const hmgetAsync = util.promisify(client.hmget).bind(client)

async function addOneTarget ({
  id,
  url,
  value,
  maxAcceptsPerDay,
  accept
}) {
  const targetData = { id, url, value, maxAcceptsPerDay, accept }
  const reply = await hsetAsync(
    'targets',
    id,
    JSON.stringify(targetData)
  )

  if (!reply) return null

  await addTargetGeoStateAndHour(targetData)
  return targetData
}

async function getAllTargets () {
  const allTargets = await hgetallAsync('targets')
  if (!allTargets || typeof allTargets !== 'object') return []

  const parsedTargets = Object.keys(allTargets)
    .map(key => JSON.parse(allTargets[key]))
  return parsedTargets
}

async function getTargetById (targetId) {
  const targetData = await hgetAsync('targets', targetId)
  return targetData ? JSON.parse(targetData) : null
}

async function updateTargetById (existingTarget, {
  id,
  url,
  value,
  maxAcceptsPerDay,
  accept
}) {
  const targetUpdate = { id, url, value, maxAcceptsPerDay, accept }

  await updateTargetGeoStateAndHour(
    existingTarget,
    targetUpdate
  )

  const reply = await hsetAsync(
    'targets',
    existingTarget.id,
    JSON.stringify(targetUpdate)
  )

  return reply !== null && reply !== undefined
    ? targetUpdate
    : null
}

async function getVisitorDecision (visitorData) {
  const { geoState } = visitorData
  const hour = (new Date(visitorData.timestamp))
    .getUTCHours().toString()

  const geostateHourMatches = await filterTargetsByGeoStateAndHour(
    geoState,
    hour
  )

  if (!geostateHourMatches.length) return { decision: 'reject' }

  const targetsData = await getManyTargetsByIds(geostateHourMatches)

  const filteredTargets = await filterTargetsByDailyAccepts(targetsData)

  const chosenTarget = chooseTargetWithHighestValue(filteredTargets)
  if (!chosenTarget) return { decision: 'reject' }

  await addTargetDailyAcceptCount(chosenTarget.id)

  return { url: chosenTarget.url }
}

async function getManyTargetsByIds (targetIds) {
  const targetsData = await hmgetAsync('targets', targetIds)
  return targetsData.map(JSON.parse)
}
