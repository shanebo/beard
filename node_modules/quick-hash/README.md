# quick-hash

<!-- VDOC.badges travis; standard; npm; coveralls -->
<!-- DON'T EDIT THIS SECTION (including comments), INSTEAD RE-RUN `vdoc` TO UPDATE -->
[![Build Status](https://travis-ci.org/vigour-io/quick-hash.svg?branch=master)](https://travis-ci.org/vigour-io/quick-hash)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](http://standardjs.com/)
[![npm version](https://badge.fury.io/js/quick-hash.svg)](https://badge.fury.io/js/quick-hash)
[![Coverage Status](https://coveralls.io/repos/github/vigour-io/quick-hash/badge.svg?branch=master)](https://coveralls.io/github/vigour-io/quick-hash?branch=master)

<!-- VDOC END -->

<!-- VDOC.jsdoc quickHash -->
<!-- DON'T EDIT THIS SECTION (including comments), INSTEAD RE-RUN `vdoc` TO UPDATE -->
#### var hashOfKey = quickHash(key, seed)

Murmur hash optimized for performance, not collision avoidance.
- **key** (*string*) - the string to hash
- **seed** (*number*) - a seed for hashing
- **returns** (*string*) hashOfKey - A string of 5 to 7 alpha-numeric characters

<!-- VDOC END -->

```javascript
var hash = require('vigour-util/hash')
hash('Any sting in the world!!!') // '16hck72'
```