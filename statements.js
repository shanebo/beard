const uniqueIterator = value => Math.random().toString().substring(2);


exports.exps = {
  extends:           (/^extends\s(.+)$/g),
  include:           (/^include\s+([^,]+)(,\s*((?!(,\s*content)|(content\s*$))[\s\S])*)?$/),
  includeContent:    (/^include\s+([^,]+)(,\s*((?!(,\s*content)|(content\s*$))[\s\S])*)?,\s*content$/),
  endInclude:        (/^endinclude$/),
  put:               (/^put\s+(.+)$/),
  exists:            (/^exists\s+(.+)$/),
  block:             (/^block\s+(.[^}]*)/),
  blockEnd:          (/^endblock$/),
  encode:            (/^\:(.*)/),
  comment:           (/^\*.*\*$/),
  statement:         (/{{\s*([\S\s(?!}})]+?)\s*}}(?!\})/g),
  if:                (/^if\s+([^]*)$/),
  elseIf:            (/^else\s+if\s+([^]*)$/),
  else:              (/^else$/),
  for:               (/^for\s+([$A-Za-z_][0-9A-Za-z_]*)(?:\s*,\s*([$A-Za-z_][0-9A-Za-z_]*))?\s+in\s+(.*)$/),
  each:              (/^each\s+([$A-Za-z_][0-9A-Za-z_]*)(?:\s*,\s*([$A-Za-z_][0-9A-Za-z_]*))?\s+in\s(.*)$/),
  end:               (/^end$/),
  customTag:         (/^(?!)$/),
  customContentTag:  (/^(?!)$/),
  endCustomTag:      (/^(?!)$/)
};


exports.parse = {

  extends: (_, path) => `
    _context.globals.content = _buffer;
    _buffer = _context.compiled(${path}, _currentPath)(_context);
  `,

  block: (_, blockname) => `
    _blockNames.push("${blockname}");
    _blockCaptures.push('');
  `,

  blockEnd: () => `
    eval(\`var \${_blockNames[_blockNames.length - 1]} = _blockCaptures[_blockCaptures.length - 1]\`);
    _context.globals[_blockNames[_blockNames.length - 1]] = _blockCaptures[_blockCaptures.length - 1];
    _blockNames.pop(); _blockCaptures.pop();
  `,

  put: (_, varname) => `
    _capture(typeof ${varname} !== "undefined" ? ${varname} : "");
  `,

  exists: (_, varname) => `
    if (typeof ${varname} !== "undefined") {
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

  customTag: (_, name, firstArg, data) => `
    _capture(
      _context.customTag(
        "${name}",
        _currentPath,
        ${firstArg},
        ${data == null ? '' : data}
      )
    );
  `,

  customContentTag: (_, name, firstArg, data) => `
    _blockNames.push('content');
    _blockCaptures.push('');
    _capturePaths.push(${firstArg});
    _captureArgs.push(${data == null ? '{}' : data.replace(/^,/, '')});
  `,

  endCustomTag: (_, name) => `
    _blockNames.pop();
    _capture(
      _context.customContentTag(
        "${name}",
        _currentPath,
        _capturePaths.pop(),
        _captureArgs.pop(),
        _blockCaptures.pop()
      )
    );
  `,

  include: (_, path, args) => `
    _capture(
      _context.include(
        _context,
        _currentPath,
        ${path} ${args == null ? '' : args}
      )
    );
  `,

  includeContent: (_, path, args) => `
    _blockNames.push('content');
    _blockCaptures.push('');
    _capturePaths.push(${path});
    _captureArgs.push(${args == null ? '{}' : args.replace(/^,/, '')});
  `,

  endInclude: () => `
    var __locals = _captureArgs.pop();
    __locals.content = _blockCaptures.pop();
    _blockNames.pop();
    _capture(
      _context.include(
        _context,
        _currentPath,
        _capturePaths.pop(),
        __locals
      )
    );
  `,

  for: (_, value, key, objValue) => {
    if (!key) key = `_iterator_${uniqueIterator(value)}`;
    const obj = `_iterator_${uniqueIterator(value)}`;
    return `
      var ${obj} = ${objValue};
      for (var ${key} in ${obj}) {
        var ${value} = ${obj}[${key}];
    `;
  },

  each: (_, value, iter, arrValue) => {
    if (!iter) iter = `_iterator_${uniqueIterator(value)}`;
    const length = `_iterator_${uniqueIterator(value)}`;
    const arr = `_iterator_${uniqueIterator(value)}`;
    return `
      for (var ${iter} = 0, ${arr} = ${arrValue}, ${length} = ${arr}.length; ${iter} < ${length}; ${iter}++) {
        var ${value} = ${arr}[${iter}];
    `;
  }
};
