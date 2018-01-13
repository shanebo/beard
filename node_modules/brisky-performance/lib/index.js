'use strict'
const test = require('tape')
const hash = require('quick-hash')
const memoized = {}
const methods = require('./methods')
const type = require('./type')

/**
 * @id perf
 * @function perf
 * @param {function} subject - function to measure
 * @param {function} reference - function to compare with `subject`
 * @param {number} margin - number of times faster `subject` must be compared to `reference` for the test to pass
 * @param {number} loop - Number of times to run the functions (default: `10`)
 * @param {string} subjectLabel - Label for the subject function (default: the name of the function (`subject.name`))
 * @param {string} referenceLabel - Label for the reference function (default: the name of the function (`reference.name`))
 */
module.exports = exports = (a, b, label, margin, loop, params, aLabel, bLabel) => {
  if (typeof label !== 'string') {
    bLabel = aLabel
    aLabel = params
    params = loop
    loop = margin
    margin = label
  }
  aLabel = aLabel || a.name || 'a'
  bLabel = bLabel || b.name || 'b'
  if (!label) {
    if (margin) {
      label = `"${aLabel}" should not be slower then ${margin} x "${bLabel}"`
    } else {
      label = `"${aLabel}" should not be slower then "${bLabel}"`
    }
  }

  if (!loop) {
    loop = 10
  } else {
    label += ` over ${loop} iteration${loop > 1 ? 's' : ''}`
  }

  test(
    label,
    t => {
      exec(a, params, loop, msA => {
        exec(b, params, loop, msB => {
          var msRes = margin ? margin * msB : msB
          var round = (msRes - msA) + ''
          var roundIndex = 10
          for (var i in round) {
            if (round[i] !== '-' && round[i] !== '0' && round[i] !== '.') {
              roundIndex = Number('1e' + i)
              break
            }
          }
          var prettyA = Math.round(msA * roundIndex) / roundIndex
          var prettyB = Math.round(msRes * roundIndex) / roundIndex
          t.equal(
            msA < msRes,
            true,
            `
             ${prettyA} ms
             is smaller then
             ${prettyB} ms
            `
          )
          t.end()
        })
      })
    }
  )
}

for (let key in methods) {
  exports[key] = methods[key]
}

exports.type = type

function exec (fn, params, loop, next) {
  var fnHash = hash(fn.toString())
  var cache = memoized[fnHash]
  var ms
  if (cache) {
    for (var i in cache) {
      if (
        cache[i].params === params &&
        cache[i].loop === loop
      ) {
        ms = cache[i].ms
        next(ms)
        return
      }
    }
  }
  methods.run(fn, ms => {
    if (!cache) { cache = memoized[fnHash] = [] }
    ms = ms / loop
    cache.push({ loop: loop, params: params, ms: ms })
    next(ms)
  }, loop)
}
