const crypto = require('crypto');

exports.cleanWhitespace = str => str.replace(/\s+/g, ' ').trim();

exports.hash = (str) => crypto
  .createHash('md5')
  .update(str)
  .digest('hex')
  .slice(-6);
