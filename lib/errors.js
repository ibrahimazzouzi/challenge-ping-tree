module.exports = {
  notFoundError: Object.assign(new Error(), { statusCode: 404 }),
  InvalidBodyError: Object.assign(new Error(), { statusCode: 400 }),
  ConflictError: Object.assign(new Error(), { statusCode: 409 })
}
