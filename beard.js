const fs = require('fs');
const exts = '(.beard$)';
const traversy = require('traversy');
const normalize = require('path').normalize;

function hash(str) {
  let hash = 5381;
  let i = str.length;
  while (i) hash = (hash * 33) ^ str.charCodeAt(--i);
  return hash >>> 0;
}

const cleanWhitespace = str => str.replace(/\s+/g, ' ').trim();
const getDir = path => path.replace(/\/[^\/]+$/, '');

module.exports = function(opts = {}) {
  // have defaults that we merge the opts passed into with
  if (!opts.hasOwnProperty('cache')) opts.cache = true;
  if (!opts.hasOwnProperty('asset')) opts.asset = (path) => false;
  opts.templates = opts.templates || {};

  let fnCache = {};
  let pathMap = {};
  let iterator = 0;
  let tags = [
    'include', 'block', 'blockEnd',
    'asset', 'put', 'encode', 'comment',
    'if', 'exists', 'elseIf', 'else',
    'for', 'each', 'end'
  ];

  const Beard = function() {
    if (opts.root) {
      const regex = new RegExp(`(^${opts.root}|.beard$)`, 'g');
      traversy(opts.root, exts, (path) => {
        const key = path.replace(regex, '');
        const body = fs.readFileSync(path, 'utf8');
        opts.templates[key] = opts.cache ? cleanWhitespace(body) : body;
        pathMap[key] = path;
      });
    }
  }

  Beard.prototype = {
    render: (path, data = {}) => {
      iterator = 0;
      return compiled(path, '/')({
        globals: {},
        locals: [data],
        path: null,
        compiled,
        asset
      });
    }
  };

  function resolvePath(path, parentPath) {
    return path.startsWith('/')
      ? path
      : normalize(`${getDir(parentPath)}/${path}`);
  }

  function asset(p, path) {
    const absolutePath = resolvePath(p, path);
    return opts.asset(absolutePath) || absolutePath;
  }

  const exps = {
    extends:    (/\{{extends\s\'([^}}]+?)\'\}}/g),
    include:    (/^include\s\'([^\(]*?)\'(\s*,\s+([\s\S]+))?$/m),
    asset:      (/^asset\s+\'(.+)\'$/),
    put:        (/^put\s+(.+)$/),
    exists:     (/^exists\s+(.+)$/),
    block:      (/^block\s+(.[^}]*)/),
    blockEnd:   (/^endblock$/),
    encode:     (/^\:(.*)/),
    comment:    (/^\*.*\*$/),
    statement:  (/{{\s*([\S\s(?!}})]+?)\s*}}(?!\})/g),
    if:         (/^if\s+([^]*)$/),
    elseIf:     (/^else\s+if\s+([^]*)$/),
    else:       (/^else$/),
    for:        (/^for\s+([$A-Za-z_][0-9A-Za-z_]*)(?:\s*,\s*([$A-Za-z_][0-9A-Za-z_]*))?\s+in\s+(.*)$/),
    each:       (/^each\s+([$A-Za-z_][0-9A-Za-z_]*)(?:\s*,\s*([$A-Za-z_][0-9A-Za-z_]*))?\s+in\s(.*)$/),
    end:        (/^end$/)
  };

  const parse = {
    block:      (_, blockname) => `_blockName = "${blockname}"; _blockCapture = "";`,
    blockEnd:   () => 'eval(`var ${_blockName} = _blockCapture`); _context.globals[_blockName] = _blockCapture; _blockName = null;',
    asset:      (_, path) => `_capture(_context.asset("${path}", _context.path));`,
    put:        (_, varname) => `_capture(typeof ${varname} !== "undefined" ? ${varname} : "");`,
    exists:     (_, varname) => `if (typeof ${varname} !== "undefined") {`,
    encode:     (_, statement) => `_encode(${statement});`,
    comment:    () => '',
    if:         (_, statement) => `if (${statement}) {`,
    elseIf:     (_, statement) => `} else if (${statement}) {`,
    else:       () => '} else {',
    end:        () => '}',
    include:    (_, includePath, __, data) => {
      data = data || '{}';
      return `
        _context.locals.push(Object.assign(_context.locals[_context.locals.length - 1], ${data}));
        _capture(_context.compiled("${includePath}", _context.path)(_context));
        _context.locals.pop();
      `;
    },
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
    const reducer = (inner, tag) => inner.replace(exps[tag], parse[tag]);
    inner = tags.reduce(reducer, inner);

    const middle = inner === prev && !/^:/.test(inner)
      ? `_capture(${inner});`
      : inner.replace(/\t|\n|\r|^:/, '');

    return `"); ${middle} _capture("`;
  }

  function compiled(path, parentPath) {
    const fullPath = resolvePath(path, parentPath);
    if (opts.cache) {
      const str = opts.templates[fullPath];
      const key = hash(fullPath);
      if (!fnCache[key]) fnCache[key] = compile(str, fullPath);
      return fnCache[key];
    } else {
      const str = fs.readFileSync(pathMap[fullPath], 'utf8');
      return compile(str, fullPath);
    }
  }

  function compile(str, currentPath) {
    let layout = '';

    str = str
      .replace(exps.extends, (_, path) => {
        layout = `
          _context.globals.view = _buffer;
          _buffer = _context.compiled('${path}', '${currentPath}')(_context);
        `;
        return '';
      })
      .replace(new RegExp('\\\\', 'g'), '\\\\').replace(/"/g, '\\"')
      .replace(exps.statement, parser);

    const fn = `
        var _buffer = '';
        var _blockName;
        var _blockCapture;

        function _capture(str) {
          if (_blockName) {
            _blockCapture += str;
          } else {
            _buffer += str;
          }
        }

        function _encode(str) {
          _capture(str
            .replace(/&(?!\\w+;)/g, '&#38;')
            .replace(/\</g, '&#60;')
            .replace(/\>/g, '&#62;')
            .replace(/\"/g, '&#34;')
            .replace(/\'/g, '&#39;')
            .replace(/\\//g, '&#47;'));
        }

        for (var prop in _context.globals) {
          if (_context.globals.hasOwnProperty(prop)) {
            eval('var ' + prop + ' = _context.globals[prop]');
          }
        }

        var _locals = _context.locals[_context.locals.length - 1];
        for (var prop in _locals) {
          if (_locals.hasOwnProperty(prop)) {
            eval('var ' + prop + ' = _locals[prop]');
          }
        }

        _context.path = '${currentPath}';

        _capture("${str}");
        ${layout}
        return _buffer;
    `.replace(/_capture\(""\);(\s+)?/g, '');

    try {
      return new Function('_context', cleanWhitespace(fn));
    } catch (e) {
      throw new Error(`Compilation error: ${fn}`);
    }
  }

  return new Beard();
};
