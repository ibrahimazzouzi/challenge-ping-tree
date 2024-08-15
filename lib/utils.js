const client = require('./redis')
const util = require('util')

module.exports = {
  filterTargetsByGeoStateAndHour,
  addTargetGeoStateAndHour,
  addTargetDailyAcceptCount,
  filterTargetsByDailyAccepts,
  chooseTargetWithHighestValue
}

const sinterAsync = util.promisify(client.sinter).bind(client)
const saddAsync = util.promisify(client.sadd).bind(client)
const incrAsync = util.promisify(client.incr).bind(client)
const expireAsync = util.promisify(client.expire).bind(client)
const getAsync = util.promisify(client.get).bind(client)

async function addTargetGeoStateAndHour (target) {
  const { id, accept } = target
  const { geoState, hour } = accept

  const geoStatePromises = geoState.$in.map(
    state => saddAsync(`geoState:${state}`, id)
  )

  const hourPromises = hour.$in.map(h => saddAsync(`hour:${h}`, id))
  await Promise.all([...geoStatePromises, ...hourPromises])
}

async function addTargetDailyAcceptCount (targetId) {
  const todayDateString = new Date().toISOString().slice(0, 10)
  const key = `target:${targetId}:accepts:${todayDateString}`

  const count = await incrAsync(key)
  const timeToExpire = getSecondsUntilTomorrow()

  if (count === 1) await expireAsync(key, timeToExpire)
  return count
}

async function filterTargetsByGeoStateAndHour (geoState, hour) {
  let targetIds = await sinterAsync(
    `geoState:${geoState}`,
    `hour:${hour}`
  )

  targetIds = targetIds.filter(val => val !== null)
  return targetIds.length ? targetIds : []
}

async function filterTargetsByDailyAccepts (targetsData) {
  const todayDateString = new Date().toISOString().slice(0, 10)
  const filteredTargets = []

  for (const target of targetsData) {
    const { id: targetId } = target
    const maxAcceptsPerDay = parseInt(target.maxAcceptsPerDay, 10)
    const dailyAcceptsKey = `target:${targetId}:accepts:${todayDateString}`

    const currentAccepts = parseInt(await getAsync(dailyAcceptsKey), 10) || 0
    if (currentAccepts < maxAcceptsPerDay) filteredTargets.push(target)
  }
  return filteredTargets
}

function chooseTargetWithHighestValue (targets) {
  if (!targets || !targets.length) return null

  let bestTarget = targets[0]

  for (const currentTarget of targets) {
    if (parseFloat(currentTarget.value) > parseFloat(bestTarget.value)) {
      bestTarget = currentTarget
    }
  }
  return bestTarget
}

function getSecondsUntilTomorrow () {
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setUTCHours(24, 0, 0, 0)
  return Math.floor((tomorrow - now) / 1000)
}
