const validate = require('./validate')
const errors = require('./errors')
const { targetSchema, visitorSchema } = require('./schema')
const targetsService = require('./service')

module.exports = {
  addNewTarget,
  getAllTargets,
  getTargetById,
  updateTargetById,
  getVisitorDecision
}

async function addNewTarget ({ req, respond, opts, callback }) {
  try {
    const { body: targetData } = req
    const isValid = validate(targetSchema, targetData)

    if (!isValid) return callback(errors.InvalidBodyError)

    const targetExists = await targetsService
      .getTargetById(targetData.id)

    if (targetExists) return callback(errors.ConflictError)

    const createdTarget = await targetsService.addOneTarget(targetData)
    if (!createdTarget) throw new Error()

    respond({
      message: 'new target created successfully',
      target: createdTarget
    })
  } catch (err) {
    callback(err)
  }
}

async function getAllTargets ({ req, respond, opts, callback }) {
  try {
    const targets = await targetsService.getAllTargets()
    respond(targets)
  } catch (err) {
    callback(err)
  }
}

async function getTargetById ({ req, respond, opts, callback }) {
  try {
    const { id: targetId } = opts.params
    const targetFound = await targetsService.getTargetById(targetId)

    if (!targetFound) return callback(errors.notFoundError)

    respond(targetFound)
  } catch (err) {
    callback(err)
  }
}

async function updateTargetById ({ req, respond, opts, callback }) {
  try {
    const { id: targetId } = opts.params
    const { body } = req
    const isValid = validate(targetSchema, body)

    if (!isValid || body.id !== targetId) {
      return callback(errors.InvalidBodyError)
    }

    const targetExists = await targetsService.getTargetById(targetId)
    if (!targetExists) return callback(errors.notFoundError)

    const updatedTarget = await targetsService
      .updateTargetById(targetId, body)

    if (!updatedTarget) throw new Error()

    respond({
      message: 'target updated successfully',
      target: updatedTarget
    })
  } catch (err) {
    callback(err)
  }
}

async function getVisitorDecision ({ req, respond, opts, callback }) {
  try {
    const { body: visitorData } = req
    const isValid = validate(visitorSchema, visitorData)

    if (!isValid) return callback(errors.InvalidBodyError)

    const decision = await targetsService.getVisitorDecision(visitorData)
    if (!decision) throw new Error()

    respond(decision)
  } catch (err) {
    callback(err)
  }
}
