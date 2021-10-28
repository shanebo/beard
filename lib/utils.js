const crypto = require('crypto');
const cheerio = require('cheerio');

exports.vdom = (template) => cheerio.load(template, {
    withDomLvl1: false,
    normalizeWhitespace: false,
    xmlMode: false,
    decodeEntities: false,
    lowerCaseAttributeNames: false
  });


exports.cleanWhitespace = str => str.replace(/\s+/g, ' ').trim();

exports.escape = str => str.replace(/`/gm, '\\\`');

exports.hash = (str) => crypto
  .createHash('md5')
  .update(str)
  .digest('hex')
  .slice(-6);

exports.removeExtension = (path) => path.replace(/\.beard$/, '');
