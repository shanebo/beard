#brisky-performance
Simple performance benchmarking tools (browser and node)

[![Build Status](https://travis-ci.org/vigour-io/brisky-performance.svg?branch=master)](https://travis-ci.org/vigour-io/brisky-performance)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](http://standardjs.com/)
[![npm version](https://badge.fury.io/js/brisky-performance.svg)](https://badge.fury.io/js/brisky-performance)
[![Coverage Status](https://coveralls.io/repos/github/vigour-io/brisky-performance/badge.svg?branch=master)](https://coveralls.io/github/vigour-io/brisky-performance?branch=master)

---

#### Precise time measurement

uses `hrTime`, `webkit.performance` or `Date.now`

```javascript
const { time } = require('brisky-performance')
const start = time() // array in node, ms in browser
const elapsed = time(start)
```

When called without arguments, returns a time object
When called with an argument, returns the difference between the current time and the time passed in as argument, in milliseconds

---

#### Comparing functions

Compare a function vs another, usefull for writing perf tests

```javascript
const perf = require('brisky-performance')
// The following test will pass if `subject` executes at least 2 times as fast as `reference`
perf(function subject () {}, function reference () {}, 2)

perf(() => {}, () => {}, 'some test')
```

##### perf (subject, reference, *margin, *loop, *label)
- `subject` - function to measure
- `reference` - function to compare with `subject`
- `margin` - number of times faster `subject` must be compared to `reference` for the test to pass
- `loop` - Number of times to run the functions (default: `10`)
- `label` - Override label

When passing a string to margin or loop it will become the label

---

#### Finding IC inconsistencies

Helps finding type mismatches in functions, just counts them.
Usefull when you see the v8 warning "optmized too many times"
It's usualy too many type differences passed into the arguments

```javascript
const { type } = require('brisky-performance')
function someFunction (a, b) {
  type.test(someFunction, a, b)
}
someFunction('hello', 1)
someFunction([ 1, 2 ], null)
type.someFunction //  →
// {
//   a: { string: 1, array: 1 },
//   b: { number: 1, null: 1 }
// }

type.test('customkey', someFunction, 1, 2)
type.customkey // → { a: { number: 1 }, b: { number: 1 } }
```

---

Uses [tape](https://www.npmjs.com/package/tape) internally, which produces [TAP](https://testanything.org/) (Test Anything Protocol) output.
