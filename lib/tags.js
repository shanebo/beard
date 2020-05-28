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

const tagsWithValueAttributes = [
  'button',
  'input',
  'li',
  'meter',
  'option',
  'param',
  'progress'
];

module.exports = {
  tag: {
    render: (tagName, data) => {
      const isValueTag = tagsWithValueAttributes.includes(tagName);
      const attributes = Object.entries(data).reduce((attrs, [key, value]) => {
        if (value && ((key === 'value' && isValueTag) || !['content', 'value'].includes(key))) {
          attrs += value === true
            ? ` ${key}`
            : ` ${key}="${value}"`;
        }

        return attrs;
      }, '');

      const tag = `<${tagName}${attributes}>`;
      const tagContent = data.content || (!isValueTag && data.value ? data.value : '');

      return singletonTags.includes(tagName)
        ? tag
        : `${tag}${tagContent}</${tagName}>`;
    },
    firstArgIsResolvedPath: false,
    content: true
  }
};
