'use strict'
const skipcomments = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg
const argnames = /([^\s,]+)/g

exports.log = function logIc (key) {
  var arr = Object.keys(exports[key])
  for (var i in arr) {
    console.log(arr[i], exports[key][arr[i]])
  }
}

exports.test = function test (key, fn) {
  var ownArgs = 2
  if (typeof key === 'function') {
    fn = key
    key = fn.name
    ownArgs = 1
  }
  var args = Array.prototype.slice.call(arguments)
  var target = exports[key]
  var arr
  args = args.slice(ownArgs)
  if (!target) {
    target = exports[key] = {}
    arr = argNames(fn)
    for (let i in arr) {
      target[arr[i]] = {}
    }
  }
  arr = Object.keys(exports[key])
  for (let i in args) {
    let type = typeof args[i]
    if (type === 'object') {
      if (args[i] === null) {
        type = 'null'
      } else if (args[i] instanceof Array) {
        type = 'array'
      }
    }
    if (!target[arr[i]][type]) {
      target[arr[i]][type] = 1
    } else {
      target[arr[i]][type]++
    }
  }
}

function argNames (func) {
  var fnStr = func.toString().replace(skipcomments, '')
  var result = fnStr.slice(fnStr.indexOf('(') + 1, fnStr.indexOf(')')).match(argnames)
  if (result === null) {
    result = []
  }
  return result
}
