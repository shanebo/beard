const fs = require('fs');
const exts = '(.beard$)';
const traversy = require('traversy');
const normalize = require('path').normalize;

class BeardError {
  constructor(realError, template, lineNumber, tag) {
    this.name = 'Beard Syntax Error';
    this.message = `"{{${tag}}}" in ${template} on line ${lineNumber}`;
    this.lineNumber = lineNumber;
    this.fileName = template;
    this.functionName = tag;
    Error.captureStackTrace(this, compile);
  }
}

class Beard {
  constructor(opts = {}) {
    if (!opts.hasOwnProperty('cache')) opts.cache = true;
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

    if (this.opts.customTags) {
      exps.customTag = new RegExp('^(' + Object.keys(this.opts.customTags).join('|') + ")\\\s+([^,]+)(,\\\s*((?!(,\\\s*content)|(content\\\s*$))[\\\s\\\S])*)?$");
    }

    if (this.opts.customContentTags) {
      exps.customContentTag = new RegExp('^(' + Object.keys(this.opts.customContentTags).join('|') + ")\\\s+([^,]+)(,\\\s*((?!(,\\\s*content)|(content\\\s*$))[\\\s\\\S])*)?,\\\s*content$");
      exps.endCustomTag = new RegExp('^end(' + Object.keys(this.opts.customContentTags).join('|') + ')$');
    } else {
      this.opts.customContentTags = {};
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

  customTag(name, parentPath, path, data = {}) {
    const resolvedPath = resolvePath(path, parentPath);
    if (this.opts.customContentTags.hasOwnProperty(name)) return this.opts.customContentTags[name](resolvedPath, data);
    return this.opts.customTags[name](resolvedPath, data);
  }

  customContentTag(name, parentPath, path, data, content) {
    data.content = content;
    const resolvedPath = resolvePath(path, parentPath);
    return this.opts.customContentTags[name](resolvedPath, data);
  }

  include(context, parentPath, path, data = {}) {
    context.locals.push(Object.assign({}, context.locals[context.locals.length - 1]));
    Object.assign(context.locals[context.locals.length - 1], data);
    const result = context.compiled(path, parentPath)(context);
    context.locals.pop();
    return result;
  }

  render(path, data = {}) {
    const context = {
      globals: {},
      locals: [data],
      compiled: this.compiled.bind(this),
      include: this.include.bind(this),
      customTag: this.customTag.bind(this),
      customContentTag: this.customContentTag.bind(this)
    }
    return this.compiled(path)(context);
  }
}

function validateSyntax(templateCode, tag, lineNumber, template) {
  if (templateCode.match(/^.*\{[^\}]*$/)) templateCode += '}'; // append a } to templateCode that needs it
  if (templateCode.match(/^\}/)) templateCode = 'if (false) {' + templateCode; // prepend a { to templateCode that needs it

  try {
    new Function(templateCode);
  } catch(e) {
    throw new BeardError(e, template, lineNumber, tag);
  }
}

const cleanWhitespace = str => str.replace(/\s+/g, ' ').trim();
const getDir = path => path.replace(/\/[^\/]+$/, '');
const reducer = (inner, tag) => inner.replace(exps[tag], parse[tag]);
const uniqueIterator = value => Math.random().toString().substring(2);
const tags = [
  'include', 'includeContent', 'endInclude',
  'block', 'blockEnd', 'put', 'encode',
  'comment', 'if', 'exists', 'elseIf',
  'else', 'for', 'each', 'end', 'extends',
  'customTag', 'customContentTag', 'endCustomTag'
];

const exps = {
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
  extends:          (_, path) =>  ` _context.globals.content = _buffer; _buffer = _context.compiled(${path}, _currentPath)(_context);`,
  block:            (_, blockname) => `_blockNames.push("${blockname}"); _blockCaptures.push('');`,
  blockEnd:         () => 'eval(`var ${_blockNames[_blockNames.length - 1]} = _blockCaptures[_blockCaptures.length - 1]`); _context.globals[_blockNames[_blockNames.length - 1]] = _blockCaptures[_blockCaptures.length - 1]; _blockNames.pop(); _blockCaptures.pop();',
  put:              (_, varname) => `_capture(typeof ${varname} !== "undefined" ? ${varname} : "");`,
  exists:           (_, varname) => `if (typeof ${varname} !== "undefined") {`,
  encode:           (_, statement) => `_encode(${statement});`,
  comment:          () => '',
  if:               (_, statement) => `if (${statement}) {`,
  elseIf:           (_, statement) => `} else if (${statement}) {`,
  else:             () => '} else {',
  end:              () => '}',
  customTag:        (_, name, path, args) => `_capture(_context.customTag("${name}", _currentPath, ${path} ${args == null ? '' : args}));`,
  customContentTag: (_, name, path, args) => `_blockNames.push('content'); _blockCaptures.push(''); _capturePaths.push(${path}); _captureArgs.push(${args == null ? '{}' : args.replace(/^,/, '')});`,
  endCustomTag:     (_, name) => `_blockNames.pop(); _capture(_context.customContentTag("${name}", _currentPath, _capturePaths.pop(), _captureArgs.pop(), _blockCaptures.pop()));`,
  include:          (_, path, args) => `_capture(_context.include(_context, _currentPath, ${path} ${args == null ? '' : args}));`,
  includeContent:   (_, path, args) => `_blockNames.push('content'); _blockCaptures.push(''); _capturePaths.push(${path}); _captureArgs.push(${args == null ? '{}' : args.replace(/^,/, '')});`,
  endInclude:       () => `var __locals = _captureArgs.pop(); __locals.content = _blockCaptures.pop(); _blockNames.pop(); _capture(_context.include(_context, _currentPath, _capturePaths.pop(), __locals));`,
  for: (_, value, key, objValue) => {
    if (!key) key = `_iterator_${uniqueIterator(value)}`;
    const obj = `_iterator_${uniqueIterator(value)}`;
    return `var ${obj} = ${objValue}; for (var ${key} in ${obj}) { var ${value} = ${obj}[${key}];`;
  },
  each: (_, value, iter, arrValue) => {
    if (!iter) iter = `_iterator_${uniqueIterator(value)}`;
    const length = `_iterator_${uniqueIterator(value)}`;
    const arr = `_iterator_${uniqueIterator(value)}`;
    return `for (var ${iter} = 0, ${arr} = ${arrValue}, ${length} = ${arr}.length; ${iter} < ${length}; ${iter}++) { var ${value} = ${arr}[${iter}];`;
  }
};

function scanner(template, path) {
  let statements = [];
  const contentCompiler = (content) => statements.push(`_capture("${content}");`);
  const tagCompiler = (tag, lineNumber) => {
    const parsedStatement = parser(tag);
    validateSyntax(parsedStatement, tag, lineNumber, path);
    statements.push(parsedStatement);
  };

  exps.statement.lastIndex = 0;
  let result = exps.statement.exec(template);
  let lastIndex = 0;
  let extendsResult;

  while (result) {
    const content = template.substring(lastIndex, result.index);
    if (content.length > 0) contentCompiler(content);

    const tag = result[1];
    const extendsMatch = exps.extends.exec(tag);
    if (extendsMatch) { // hold extends until the end
      extendsResult = result;
    } else {
      const lineNumber = template.substring(0, result.index).split('\n').length;
      tagCompiler(tag, lineNumber);
    }

    lastIndex = exps.statement.lastIndex;
    result = exps.statement.exec(template);
  }

  if (lastIndex < template.length) {
    const content = template.substring(lastIndex, template.length);
    contentCompiler(content);
  }

  if (extendsResult) {
    const lineNumber = template.substring(0, extendsResult.index).split('\n').length;
    tagCompiler(extendsResult[1], lineNumber);
  }

  return statements;
}

function parser(statement) {
  const parsedStatement = tags.reduce(reducer, statement);
  return statement === parsedStatement
    ? `_capture(${statement});`
    : parsedStatement.replace(/\t|\n|\r/, '');
}

function compile(str, path) {
  const templateCode = scanner(str.replace(new RegExp('\\\\', 'g'), '\\\\').replace(/"/g, '\\"'), path).join(' ');

  const fn = `
      var _currentPath = '${path}';
      var _buffer = '';
      var _blockNames = [];
      var _blockCaptures = [];
      var _capturePaths = [];
      var _captureArgs = [];

      function _capture(str) {
        if (_blockNames.length > 0) {
          _blockCaptures[_blockCaptures.length - 1] += str;
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

      ${templateCode}
      return _buffer;
  `.replace(/_capture\(""\);(\s+)?/g, '');

  try {
    return new Function('_context', cleanWhitespace(fn));
  } catch (e) {
    throw new Error(`Compilation error: ${fn}`);
  }
}

module.exports = opts => new Beard(opts);
