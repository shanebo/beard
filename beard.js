function hash(str) {
  let hash = 5381;
  let i = str.length;

  while (i) {
    hash = (hash * 33) ^ str.charCodeAt(--i);
  }

  return hash >>> 0;
}


module.exports = function(cache = {}, resolve = (path, parentPath) => path) {
  let fnCache = {};
  let iterator = 0;

  const Beard = function() {}

  Beard.prototype = {
    render: (path, data = {}) => {
      iterator = 0;

      let context = {
        globals: {},
        locals: [data],
        path: null
      };

      return compiled(path)(context);
    }
  };

  const exps = {
    extends:    (/\{{extends\s\'([^}}]+?)\'\}}/g),
    include:    (/^include\s\'([^\(]*?)\'$/g),
    includeFn:  (/^include\((\s?\'([^\(]*?)\'\,\s?\{([^\)]*)\})\)$/g),
    block:      (/^block\s+(.[^}]*)/g),
    blockEnd:   (/^endblock$/g),
    statement:  (/{{\s*([\S\s(?!}})]+?)\s*}}/g),
    if:         (/^if\s+([^]*)$/),
    elseIf:     (/^else\s+if\s+([^]*)$/),
    else:       (/^else$/),
    for:        (/^for\s+([$A-Za-z_][0-9A-Za-z_]*)(?:\s*,\s*([$A-Za-z_][0-9A-Za-z_]*))?\s+in\s+(.*)$/),
    each:       (/^each\s+([$A-Za-z_][0-9A-Za-z_]*)(?:\s*,\s*([$A-Za-z_][0-9A-Za-z_]*))?\s+in\s(.*)$/),
    end:        (/^end$/)
  };

  const parse = {
    include:    (_, includePath) => `_capture(compiled("${includePath}", path)(_context));`,
    includeFn:  (_, __, includePath, data) => `_context.locals.push({${data}}); _capture(compiled("${includePath}", path)(_context)); _context.locals.pop();`,
    block:      (_, blockname) => `_blockName = "${blockname}"; _blockCapture = "";`,
    blockEnd:   () => 'eval(`var ${_blockName} = _blockCapture`); _context.globals[_blockName] = _blockCapture; _blockName = null;',
    if:         (_, statement) => `if (${statement}) {`,
    elseIf:     (_, statement) => `} else if (${statement}) {`,
    else:       () => '} else {',
    end:        () => '}',
    for: (_, key, value, object) => {
      if (!value) key = (value = key, 'iterator' + iterator++);
      return `for (var ${key} in ${object}){ var ${value} = ${object}[${key}];`;
    },
    each: (_, iter, value, array) => {
      if (!value) iter = (value = iter, 'iterator' + iterator++);
      const length = 'length' + iterator++;
      return `for (var ${iter} = 0, ${length} = ${array}.length; ${iter} < ${length}; ${iter}++) { var ${value} = ${array}[${(iter)}];`;
    }
  };

  function parser(match, inner) {
    const prev = inner;
    inner = inner
      .replace(exps.include, parse.include)
      .replace(exps.includeFn, parse.includeFn)
      .replace(exps.block, parse.block)
      .replace(exps.blockEnd, parse.blockEnd)
      .replace(exps.end, parse.end)
      .replace(exps.else, parse.else)
      .replace(exps.elseIf, parse.elseIf)
      .replace(exps.if, parse.if)
      .replace(exps.each, parse.each)
      .replace(exps.for, parse.for);

    const middle = inner === prev && !/^:/.test(inner)
      ? `_capture(${inner});`
      : inner.replace(/\t|\n|\r|^:/, '');

    return `"); ${middle} _capture("`;
  }

  function compiled(path, parentPath) {
    const fullPath = resolve(path, parentPath);
    const str = cache[fullPath];
    let key = hash(str);

    if (!fnCache[key]) {
      fnCache[key] = compile(str, fullPath);
    }

    return fnCache[key];
  }

  function compile(str, path) {
    let layout = '';

    str = str
      .replace(exps.extends, (_, path) => {
        layout = `
          _context.globals.view = _buffer;
          _buffer = compiled("${path}", path)(_context);
        `;
        return '';
      })
      .replace(new RegExp('\\\\', 'g'), '\\\\').replace(/"/g, '\\"')
      .replace(exps.statement, parser)
      .replace(/\n/g, '\\n')
      .replace(/\t/g, '\\t')
      .replace(/\r/g, '\\r');

    const fn = `
      function _compiledFn(_context){
        var path = "${path}";
        var _buffer = "";
        var _blockName;
        var _blockCapture;

        function _capture(str) {
          if (_blockName) {
            _blockCapture += str;
          } else {
            _buffer += str;
          }
        }

        for (var prop in _context.globals) {
          if (_context.globals.hasOwnProperty(prop)) {
            eval("var " + prop + " = _context.globals[prop]");
          }
        }

        var _locals = _context.locals[_context.locals.length - 1];
        for (var prop in _locals) {
          if (_locals.hasOwnProperty(prop)) {
            eval("var " + prop + " = _locals[prop]");
          }
        }

        _capture("${str}");
        ${layout}
        return _buffer;
      }
    `.replace(/_capture\(""\);(\s+)?/g, '');

    try {
      eval(fn);
      return _compiledFn.bind(_compiledFn);
    } catch (e) {
      throw new Error(`Compilation error: ${fn}`);
    }
  }

  return new Beard();
};
