const { normalize, resolve } = require('path');
const { bundle } = require('./bundle');
const { exps, parse } = require('./statements');
const { cleanWhitespace } = require('./utils');

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
    opts.templates = opts.templates || {};
    opts.loadHandles = opts.hasOwnProperty('loadHandles') ? opts.loadHandles : true;
    this.opts = opts;
    this.fns = {};
    this.handles = {};

    if (this.opts.root) {
      const { templates, handles } = bundle(this.opts);
      this.handles = handles;
      this.opts.templates = templates;
    }

    if (this.opts.customTags) {
      const tags = Object.keys(this.opts.customTags).join('|');
      exps.customTag = new RegExp(`^(${tags})\\\s+([^,]+)(?:,\\\s*([\\\s\\\S]*))?$`);

      const contentTags = Object.keys(this.opts.customTags).filter((key) => this.opts.customTags[key].content).join('|');
      if (contentTags.length) {
        exps.customContentTag = new RegExp(`^(${contentTags})\\\:content\\\s+([^,]+)(?:,\\\s*([\\\s\\\S]*))?$`);
        exps.endCustomTag = new RegExp(`^end(${contentTags})$`);
      }
    }
  }

  compiled(path, parentPath = '') {
    path = resolvePath(path, parentPath, this.opts.root);
    const str = this.opts.templates[path];
    if (!this.fns[path]) this.fns[path] = compile(str, path);
    return this.fns[path];
  }

  customTag(name, parentPath, firstArg, data) {
    if (this.opts.customTags[name].firstArgIsResolvedPath) firstArg = resolvePath(firstArg, parentPath, this.opts.root);
    return this.opts.customTags[name].render(
        firstArg,
        data,
        this.handles,
        this.render.bind(this),
        this.partial.call(this, parentPath)
      );
  }

  include(context, parentPath, path, data) {
    context.locals.push(data);
    const result = context.compiled(path, parentPath)(context);
    context.locals.pop();
    return result;
  }

  partial(path) {
    return (str, data) => {
      const context = {
        globals: {},
        locals: [data],
        compiled: this.compiled.bind(this),
        include: this.include.bind(this),
        customTag: this.customTag.bind(this)
      }
      return compile(str, path)(context);
    }
  }

  render(path, data = {}) {
    const context = {
      globals: {},
      locals: [data],
      compiled: this.compiled.bind(this),
      include: this.include.bind(this),
      customTag: this.customTag.bind(this)
    }

    if (this.opts.root && !path.startsWith('/')) {
      path = `${this.opts.root}/${path}`;
    }

    return this.compiled(path)(context);
  }
}

function validateSyntax(templateCode, tag, lineNumber, template) {
  templateCode = templateCode.replace(/(\r\n|\n|\r)/gm, '');
  if (templateCode.match(/^.*\{[^\}]*$/)) templateCode += '}'; // append a } to templateCode that needs it
  if (templateCode.match(/^(\s*)\}/)) templateCode = 'if (false) {' + templateCode; // prepend a { to templateCode that needs it

  try {
    new Function(templateCode);
  } catch(e) {
    throw new BeardError(e, template, lineNumber, tag);
  }
}

const getDir = path => path.replace(/\/[^\/]+$/, '');
const reducer = (inner, tag) => inner.replace(exps[tag], parse[tag]);
const tags = [
  'include', 'includeContent', 'endInclude',
  'block', 'blockEnd', 'put', 'encode',
  'comment', 'if', 'exists', 'elseIf',
  'else', 'for', 'each', 'end', 'extends',
  'customTag', 'customContentTag', 'endCustomTag'
];

function resolvePath(path, parentPath, root) {
  return path.startsWith('/')
    ? path
    : path.startsWith('~')
      ? resolve(root, path.replace(/^~/, '.'))
      : normalize(`${getDir(parentPath)}/${path}`);
}

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

    for (var _prop in _context.globals) {
      if (_context.globals.hasOwnProperty(_prop)) {
        eval('var ' + _prop + ' = _context.globals[_prop]');
      }
    }

    for (var i = 0; i < _context.locals.length; i++) {
      var _locals = _context.locals[i];
      for (var _prop in _locals) {
        if (_locals.hasOwnProperty(_prop)) {
          eval('var ' + _prop + ' = _locals[_prop]');
        }
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
