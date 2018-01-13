'use strict'
/**
 * @id time
 * @function time
 * When called without arguments, returns the current time as precisely as possible as a number of milliseconds or an array (`[milliseconds, microseconds]`)
 * When called with an argument, returns the difference between the current time and the time passed in as argument, in milliseconds
 * @param startTime {number|array} - start time for elapsed time calculation
 * @returns {number|array} t - Current time (in milliseconds) or elapsed time since `startTime`
 */
exports.time = require('is-node')
  ? time => {
    if (time) {
      const end = process.hrtime(time)
      return end[0] * 1e3 + end[1] / 1e6
    } else {
      return process.hrtime()
    }
  }
  : time => {
    if (!time) {
      return global.performance.now()
    } else {
      return global.performance.now() - time
    }
  }

/**
 * @id run
 * @function run
 * @param {function} subject - the function to measure
 * @param {function} callback - called when the measurement is done : `callback(averageRunTime, nbIterations)`
 * @param {number} nbIterations - number of times to execute the subject function
 */
exports.run = function (method, done, cnt) {
  if (!cnt) { cnt = 1 }
  perfExec(0, method, cnt, cnt, done)
}

function perfNext (ms, method, cnt, total, done) {
  cnt--
  if (!cnt) {
    done(ms, total)
  } else {
    perfExec(ms, method, cnt, total, done)
  }
}

function perfExec (ms, method, cnt, total, done) {
  var time = exports.time()
  method()
  ms += exports.time(time)
  process.nextTick(() => perfNext(ms, method, cnt, total, done))
}
