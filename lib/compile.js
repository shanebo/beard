const { normalize, resolve } = require('path');
const { tags, parsers, converters } = require('./statements');


const getDir = (path) => path.replace(/\/[^\/]+$/, '');
const cleanWhitespace = (str) => str.replace(/\s+/g, ' ').trim();
const escape = (str) => str.replace(/`/gm, '\\\`');


function resolvePath(path, parentPath, root) {
  return path.startsWith('/')
    ? path
    : path.startsWith('~')
      ? resolve(root, path.replace(/^~/, '.'))
      : normalize(`${getDir(parentPath)}/${path}`);
}


class BeardError {
  constructor(realError, template, lineNumber, statement) {
    this.name = 'Beard Syntax Error';
    this.message = `"{{${statement}}}" in ${template} on line ${lineNumber}`;
    this.lineNumber = lineNumber;
    this.fileName = template;
    this.functionName = statement;
    Error.captureStackTrace(this, compile);
  }
}


function validateSyntax(templateCode, statement, lineNumber, template) {
  templateCode = templateCode.replace(/(\r\n|\n|\r)/gm, '');
  if (templateCode.match(/^.*\{[^\}]*$/)) templateCode += '}'; // append a } to templateCode that needs it
  if (templateCode.match(/^(\s*)\}/)) templateCode = 'if (false) {' + templateCode; // prepend a { to templateCode that needs it

  try {
    new Function(templateCode);
  } catch(e) {
    throw new BeardError(e, template, lineNumber, statement);
  }
}


function compileStatement(statements, statement, path, lineNumber) {
  const convertedStr = tags.reduce((inner, tag) => inner.replace(parsers[tag], converters[tag]), statement);
  const str = statement === convertedStr
    ? `_capture(${statement});`
    : cleanWhitespace(convertedStr.replace(/\t|\n|\r/, ''));
  validateSyntax(str, statement, lineNumber, path);
  statements.push(str);
}


function compileContent(content, statements) {
  statements.push(`_capture(\`${escape(content)}\`);`);
}


function convert(template, path) {
  parsers.statement.lastIndex = 0;

  let statements = [];
  let result = parsers.statement.exec(template);
  let lastIndex = 0;
  let extendsResult;

  while (result) {
    const content = template.substring(lastIndex, result.index);

    if (content.length > 0) {
      compileContent(content, statements);
    }

    const statement = result[1];
    const extendsMatch = parsers.extends.exec(statement);

    if (extendsMatch) { // hold extends until the end
      extendsResult = result;
    } else {
      const lineNumber = template.substring(0, result.index).split('\n').length;
      compileStatement(statements, statement, path, lineNumber);
    }

    lastIndex = parsers.statement.lastIndex;
    result = parsers.statement.exec(template);
  }

  if (lastIndex < template.length) {
    const content = template.substring(lastIndex, template.length);
    compileContent(content, statements);
  }

  if (extendsResult) {
    const lineNumber = template.substring(0, extendsResult.index).split('\n').length;
    compileStatement(statements, extendsResult[1], path, lineNumber);
  }

  return statements;
}


function compile(str, path) {
  const templateCode = convert(str.replace(new RegExp('\\\\', 'g'), '\\\\').replace(/"/g, '\\"'), path).join(' ');

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


exports.resolvePath = resolvePath;
exports.compile = compile;
