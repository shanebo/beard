const uid = () => Math.random().toString().substring(2);


const tags = [
  'include', 'includeContent', 'endInclude',
  'block', 'blockEnd', 'put', 'encode',
  'comment', 'if', 'exists', 'existsNot',
  'elseIf', 'else', 'for', 'each', 'end',
  'extends', 'tag', 'contentTag', 'endTag',
  'shortcut', 'shortcutContent', 'endShortcut'
];


const parsers = {
  extends:           (/^extends\s(.+)$/g),
  include:           (/^include\s+([^,]+)(?:,\s*([\s\S]*))?$/),
  includeContent:    (/^include\:content\s+([^,]+)(?:,\s*([\s\S]*))?$/),
  endInclude:        (/^endinclude$/),
  put:               (/^put\s+(.+)$/),
  exists:            (/^exists\s+(.+)$/),
  existsNot:         (/^existsNot\s+(.+)$/),
  block:             (/^block\s+(.[^}]*)/),
  blockEnd:          (/^endblock$/),
  encode:            (/^\:(.*)/),
  comment:           (/^\*.*\*$/),
  statement:         (/{{\s*([\S\s(?!}})]+?)\s*}}(?!\})/g),
  if:                (/^if\s+([^]*)$/),
  elseIf:            (/^else\s+if\s+([^]*)$/),
  else:              (/^else$/),
  for:               (/^for\s+([$A-Za-z_][0-9A-Za-z_]*)(?:\s*,\s*([$A-Za-z_][0-9A-Za-z_]*))?\s+in\s+([^]*)$/),
  each:              (/^each\s+([$A-Za-z_][0-9A-Za-z_]*)(?:\s*,\s*([$A-Za-z_][0-9A-Za-z_]*))?\s+in\s([^]*)$/),
  end:               (/^end$/),
  tag:               (/^(?!)$/),
  contentTag:        (/^(?!)$/),
  endTag:            (/^(?!)$/),
  shortcut:          (/^(?!)$/),
  shortcutContent:   (/^(?!)$/),
  endShortcut:       (/^(?!)$/)
};


const converters = {

  extends: (_, path) => `
    _context.globals.content = _buffer;
    _buffer = _context.compiled(${path}, _currentPath)(_context);
  `,

  block: (_, blockname) => `
    _blockNames.push("${blockname}");
    _blockCaptures.push('');
  `,

  blockEnd: () => `
    var blockName = _blockNames[_blockNames.length - 1];
    var blockContent = _blockCaptures[_blockCaptures.length - 1];
    if (_captureArgs.length > 0) {
      _captureArgs[_captureArgs.length - 1][1][blockName] = blockContent;
    } else {
      eval(\`var \${blockName} = blockContent\`);
      _context.globals[blockName] = blockContent;
    }
    _blockNames.pop();
    _blockCaptures.pop();
  `,

  put: (_, varname) => `
    _capture(typeof ${varname} !== "undefined" ? ${varname} : "");
  `,

  exists: (_, varname) => `
    if (typeof ${varname} !== "undefined") {
  `,

  existsNot: (_, varname) => `
    if (typeof ${varname} === "undefined") {
  `,

  encode: (_, statement) => `
    _encode(${statement});
  `,

  comment: () => '',

  if: (_, statement) => `
    if (${statement}) {
  `,

  elseIf: (_, statement) => `
    } else if (${statement}) {
  `,

  else: () => `
    } else {
  `,

  end: () => `
    }
  `,

  tag: (_, name, firstArg, data) => `
    _capture(
      _context.tag(
        "${name}",
        _currentPath,
        ${firstArg},
        ${data == null ? '{}' : data}
      )
    );
  `,

  contentTag: (_, name, firstArg, data) => `
    _blockNames.push('content');
    _blockCaptures.push('');
    _captureArgs.push([
      ${firstArg},
      ${data == null ? '{}' : data.replace(/^,/, '')}
    ]);
  `,

  endTag: (_, name) => `
    _blockNames.pop();
    var __args = _captureArgs.pop();
    __args[1].content = _blockCaptures.pop();
    _capture(
      _context.tag(
        "${name}",
        _currentPath,
        ...__args
      )
    );
  `,

  shortcut: (_, name, data) => `
    _capture(
      _context.shortcut(
        "${name}",
        _currentPath,
        ${data == null ? '{}' : data}
      )
    );
  `,

  shortcutContent: (_, name, data) => `
    _blockNames.push('content');
    _blockCaptures.push('');
    _captureArgs.push([
      null,
      ${data == null ? '{}' : data.replace(/^,/, '')}
    ]);
  `,

  endShortcut: (_, name) => `
    _blockNames.pop();
    var __args = _captureArgs.pop();
    __args.shift();
    __args[0].content = _blockCaptures.pop();
    _capture(
      _context.shortcut(
        "${name}",
        _currentPath,
        ...__args
      )
    );
  `,

  include: (_, path, data) => `
    _capture(
      _context.include(
        _context,
        _currentPath,
        ${path},
        ${data == null ? '{}' : data}
      )
    );
  `,

  includeContent: (_, path, data) => `
    _blockNames.push('content');
    _blockCaptures.push('');
    _captureArgs.push([
      ${path},
      ${data == null ? '{}' : data.replace(/^,/, '')}
    ]);
  `,

  endInclude: () => `
    var __args = _captureArgs.pop();
    __args[1].content = _blockCaptures.pop();
    _blockNames.pop();
    _capture(
      _context.include(
        _context,
        _currentPath,
        ...__args
      )
    );
  `,

  for: (_, value, key, objValue) => {
    if (!key) key = `_iterator_${uid()}`;
    const obj = `_iterator_${uid()}`;
    return `
      var ${obj} = ${objValue};
      for (var ${key} in ${obj}) {
        var ${value} = ${obj}[${key}];
    `;
  },

  each: (_, value, iter, arrValue) => {
    if (!iter) iter = `_iterator_${uid()}`;
    const length = `_iterator_${uid()}`;
    const arr = `_iterator_${uid()}`;
    return `
      for (var ${iter} = 0, ${arr} = ${arrValue}, ${length} = ${arr}.length; ${iter} < ${length}; ${iter}++) {
        var ${value} = ${arr}[${iter}];
    `;
  }
};


const htmlSingletonTags = [
  'area', 'base', 'br', 'col',
  'command', 'embed', 'hr', 'img',
  'input', 'keygen', 'link', 'meta',
  'param', 'source', 'track', 'wbr'
];


const htmlTagsWithValueAttributes = [
  'button', 'input', 'li', 'meter',
  'option', 'param', 'progress'
];


const defaultTag = {
  tag: {
    render: (tagName, data) => {
      const isValueTag = htmlTagsWithValueAttributes.includes(tagName);
      const attributes = Object.entries(data).reduce((attrs, [key, value]) => {
        if ((value || typeof value === 'string') && ((key === 'value' && isValueTag) || !['content', 'value'].includes(key))) {
          attrs += value === true
            ? ` ${key}`
            : ` ${key}="${value}"`;
        }

        return attrs;
      }, '');

      const tag = `<${tagName}${attributes}>`;
      const tagContent = data.content || (!isValueTag && data.value ? data.value : '');

      return htmlSingletonTags.includes(tagName)
        ? tag
        : `${tag}${tagContent}</${tagName}>`;
    },
    firstArgIsResolvedPath: false,
    content: true
  }
};


exports.defaultTag = defaultTag;
exports.tags = tags;
exports.parsers = parsers;
exports.converters = converters;
