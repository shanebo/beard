exports.cleanWhitespace = str => str.replace(/\s+/g, ' ').trim();

exports.escape = str => str.replace(/`/gm, '\\\`');
