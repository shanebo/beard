'use strict'

var test = require('tape')
var hash = require('../')

var testCases = [
  'ASDFLKJH56789)*&^$`Ω≈ç√¥¨∆†',
  123456789
]

test('hash', (t) => {
  t.plan(2 * testCases.length)
  testCases.forEach((item) => {
    var hsh = hash(item)
    var len = hsh.length
    var hsh2 = hash(item)
    t.equals(len > 4 && len < 8, true, 'hash(' + item + ').length.length > 4 && < 8')
    t.equals(hsh, hsh2, 'should always produce the same hash')
  })
})
