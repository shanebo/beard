const singletonTags = [
  'area',
  'base',
  'br',
  'col',
  'command',
  'embed',
  'hr',
  'img',
  'input',
  'keygen',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr'
];

const tagAttribute = (key, value) => value === true
    ? key
    : `${key}="${value}"`;

module.exports = {
  tag: {
    render: (tagName, data) => {
      const attributes = Object.entries(data).reduce((attrs, [key, value]) => {
        return value && key !== 'content'
          ? attrs += ` ${tagAttribute(key, value)}`
          : attrs
      }, '');

      const tag = `<${tagName}${attributes}>`;

      return singletonTags.includes(tagName)
        ? tag
        : `${tag}${data.content || ''}</${tagName}>`;
    },
    firstArgIsResolvedPath: false,
    content: true
  }
};
