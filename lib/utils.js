exports.cleanWhitespace = str => str.replace(/\s+/g, ' ').trim();


exports.hash = (str) => {
  // not doing this at all mignt be faster
  // return str;
  let hash = 5381;
  let i = str.length;
  while (i) hash = (hash * 33) ^ str.charCodeAt(--i);
  return (hash >>> 0).toString();
}
