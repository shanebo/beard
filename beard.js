const fs = require('fs');
const exts = '(.beard$)';
const traversy = require('traversy');
const normalize = require('path').normalize;

class Beard {
  constructor(opts = {}) {
    if (!opts.hasOwnProperty('cache')) opts.cache = true;
    if (!opts.hasOwnProperty('asset')) opts.asset = path => false;
    opts.templates = opts.templates || {};
    this.opts = opts;
    this.fnCache = {};
    this.pathMap = {};

    if (this.opts.root) {
      const regex = new RegExp(`(^${this.opts.root}|.beard$)`, 'g');
      traversy(this.opts.root, exts, (path) => {
        const key = path.replace(regex, '');
        const body = fs.readFileSync(path, 'utf8');
        this.opts.templates[key] = this.opts.cache ? cleanWhitespace(body) : body;
        this.pathMap[key] = path;
      });
    }
  }

  compiled(path, parentPath = '') {
    path = resolvePath(path, parentPath);
    if (this.opts.cache) {
      const str = this.opts.templates[path];
      const key = hash(path);
      if (!this.fnCache[key]) this.fnCache[key] = compile(str, path);
      return this.fnCache[key];
    } else {
      const str = fs.readFileSync(this.pathMap[path], 'utf8');
      return compile(str, path);
    }
  }

  asset(p, path) {
    const absolutePath = resolvePath(p, path);
    return this.opts.asset(absolutePath) || absolutePath;
  }

  render(path, data = {}) {
    const context = {
      globals: {},
      locals: [data],
      compiled: this.compiled.bind(this),
      asset: this.asset.bind(this)
    }
    return this.compiled(path)(context);
  }
}

const cleanWhitespace = str => str.replace(/\s+/g, ' ').trim();
const getDir = path => path.replace(/\/[^\/]+$/, '');
const reducer = (inner, tag) => inner.replace(exps[tag], parse[tag]);
const uniqueIterator = value => Math.random().toString().substring(2);
const tags = [
  'include', 'block', 'blockEnd',
  'asset', 'put', 'encode', 'comment',
  'if', 'exists', 'elseIf', 'else',
  'for', 'each', 'end'
];

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

function resolvePath(path, parentPath) {
  return path.startsWith('/')
    ? path
    : normalize(`${getDir(parentPath)}/${path}`);
}

function hash(str) {
  let hash = 5381;
  let i = str.length;
  while (i) hash = (hash * 33) ^ str.charCodeAt(--i);
  return hash >>> 0;
}

const parse = {
  block:      (_, blockname) => `_blockName = "${blockname}"; _blockCapture = "";`,
  blockEnd:   () => 'eval(`var ${_blockName} = _blockCapture`); _context.globals[_blockName] = _blockCapture; _blockName = null;',
  asset:      (_, path) => `_capture(_context.asset("${path}", _currentPath));`,
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
      _capture(_context.compiled("${includePath}", _currentPath)(_context));
      _context.locals.pop();
    `;
  },
  for: (_, key, value, object) => {
    if (!value) {
      value = key;
      key = `_iterator_${uniqueIterator(value)}`;
    }
    return `for (var ${key} in ${object}) { var ${value} = ${object}[${key}];`;
  },
  each: (_, iter, value, array) => {
    if (!value) {
      value = iter;
      iter = `_iterator_${uniqueIterator(value)}`;
    }
    const length = `_iterator_${uniqueIterator(value)}`;
    return `for (var ${iter} = 0, ${length} = ${array}.length; ${iter} < ${length}; ${iter}++) { var ${value} = ${array}[${iter}];`;
  }
};

function parser(match, inner) {
  const prev = inner;
  inner = tags.reduce(reducer, inner);
  const middle = inner === prev && !/^:/.test(inner)
    ? `_capture(${inner});`
    : inner.replace(/\t|\n|\r|^:/, '');
  return `"); ${middle} _capture("`;
}

function compile(str, path) {
  let layout = '';

  str = str
    .replace(exps.extends, (_, path) => {
      layout = `
        _context.globals.view = _buffer;
        _buffer = _context.compiled('${path}', _currentPath)(_context);
      `;
      return '';
    })
    .replace(new RegExp('\\\\', 'g'), '\\\\').replace(/"/g, '\\"')
    .replace(exps.statement, parser);

  const fn = `
      var _currentPath = '${path}';
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

module.exports = opts => new Beard(opts);
