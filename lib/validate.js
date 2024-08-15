module.exports = validate

function validate (schema, body) {
  return validateSchema(schema, body, true)
}

function validateSchema (schema, body, isValid) {
  let result = null

  if (!isValid || !body) return false

  for (const key in schema) {
    const expectedType = schema[key]
    const actualValue = body[key] || null

    // any falsy value is considered invalid
    if (!actualValue) result = false

    if (
      typeof expectedType === 'object' &&
      !Array.isArray(expectedType)
    ) {
      result = validateSchema(expectedType, actualValue, isValid)
      if (!result) break
    } else {
      result = checkType(expectedType, actualValue)
      if (!result) break
    }
  }

  return result
}

function checkType (expectedType, actualValue) {
  const actualType = Array.isArray(actualValue)
    ? 'array'
    : typeof actualValue === 'object'
      ? 'object'
      : typeof actualValue

  const incorrectTypes = (
    (expectedType === 'array' &&
      !Array.isArray(actualValue)
    ) ||
    (expectedType === 'object' &&
      (actualType !== 'object' || Array.isArray(actualValue))
    ) ||
    (actualType !== expectedType)
  )
  return !incorrectTypes
}
