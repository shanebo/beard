const { normalize, resolve } = require('path');
const { exps, parse } = require('./statements');
const { cleanWhitespace, escape } = require('./utils');
const defaultTags = require('./tags');
const { merge } = require('merge-anything');


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

    this.opts = opts;
    this.fns = {};
    this.opts.tags = merge(defaultTags, this.opts.tags || {});
    this.configureTags(this.opts.tags);

    if (this.opts.shortcuts) {
      this.configureShortcuts(this.opts.shortcuts, this.opts.tags);
    }
  }

  configureTags(tags) {
    exps.tag = new RegExp(`^(${Object.keys(tags).join('|')})\\\s+([^,]+)(?:,\\\s*([\\\s\\\S]*))?$`);

    const contentTags = Object.keys(tags).filter((key) => tags[key].content).join('|');
    if (contentTags.length) {
      exps.contentTag = new RegExp(`^(${contentTags})\\\:content\\\s+([^,]+)(?:,\\\s*([\\\s\\\S]*))?$`);
      exps.endTag = new RegExp(`^end(${contentTags})$`);
    }
  }

  configureShortcuts(shortcuts, tags) {
    exps.shortcut = new RegExp(`^@(${Object.keys(shortcuts).join('|')})(?:(?:\\\s+)([\\\s\\\S]+))?$`);

    const contentTags = Object.keys(shortcuts).filter((key) => tags[shortcuts[key].tag].content).join('|');
    if (contentTags.length) {
      exps.shortcutContent = new RegExp(`^@(${contentTags})\\\:content(?:(?:\\\s+)([\\\s\\\S]+))?$`);
      exps.endShortcut = new RegExp(`^end(${contentTags})$`);
    }
  }

  compiled(path, parentPath = '') {
    path = resolvePath(path, parentPath, this.opts.root);
    const str = this.opts.templates[path];
    if (process.env.NODE_ENV === 'development' || !this.fns[path]) {
      this.fns[path] = compile(str, path, this.opts.root);
    }
    return this.fns[path];
  }

  tag(name, parentPath, firstArg, data) {
    if (this.opts.tags[name].firstArgIsResolvedPath) firstArg = resolvePath(firstArg, parentPath, this.opts.root);
    return this.opts.tags[name].render(
        firstArg,
        data,
        this.render.bind(this),
        this.partial.bind(this)
      );
  }

  shortcut(name, parentPath, data) {
    const tag = this.opts.shortcuts[name].tag;
    const path = this.opts.shortcuts[name].path;
    return this.tag(tag, parentPath, path, data);
  }

  include(context, parentPath, path, data) {
    context.locals.push(data);
    const result = context.compiled(path, parentPath)(context);
    context.locals.pop();
    return result;
  }

  partial(str, data) {
    const context = {
      globals: {},
      locals: [data],
      compiled: this.compiled.bind(this),
      include: this.include.bind(this),
      tag: this.tag.bind(this),
      shortcut: this.shortcut.bind(this)
    }
    return compile(str, this.opts.root || '/')(context);
  }

  render(path, data = {}) {
    const context = {
      globals: {},
      locals: [data],
      compiled: this.compiled.bind(this),
      include: this.include.bind(this),
      tag: this.tag.bind(this),
      shortcut: this.shortcut.bind(this)
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
  'comment', 'if', 'exists', 'existsNot',
  'elseIf', 'else', 'for', 'each', 'end',
  'extends', 'tag', 'contentTag', 'endTag',
  'shortcut', 'shortcutContent', 'endShortcut'
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
  const contentCompiler = (content) => statements.push(`_capture(\`${escape(content)}\`);`);
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
    : cleanWhitespace(parsedStatement.replace(/\t|\n|\r/, ''));
}

function compile(str, path, root) {
  const templateCode = scanner(str.replace(new RegExp('\\\\', 'g'), '\\\\').replace(/"/g, '\\"'), path).join(' ');

  const fn = `
    ${cleanWhitespace(`
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
        eval('var ' + _prop + ' = _context.globals[_prop]');
      }

      for (var i = 0; i < _context.locals.length; i++) {
        var _locals = _context.locals[i];
        for (var _prop in _locals) {
          eval('var ' + _prop + ' = _locals[_prop]');
        }
      }
    `)}
    ${templateCode}
    return _buffer;
  `.replace(/_capture\(``\);(\s+)?/g, '');

  try {
    return new Function('_context', fn);
  } catch (e) {
    throw new Error(`Compilation error: ${fn}`);
  }
}

module.exports = opts => new Beard(opts);
