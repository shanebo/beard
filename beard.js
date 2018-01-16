module.exports = function(cache = {}, lookup = path => path) {
  let compiledCache = {};
  let iterator = 0;

  const Beard = function() {}

  Beard.prototype = {
    render: (template, data = {}) => {
      iterator = 0;
      return compiled(template, data)(data);
    }
  };

  const exps = {
    extends:    (/\{{extends\s\'([^}}]+?)\'\}}/g),
    include:    (/^include\s\'([^\(]*?)\'$/g),
    includeFn:  (/^include\((\s?\'([^\(]*?)\'\,\s?\{([^\)]*)\})\)$/g),
    block:      (/{{block\s+(.[^}]*)}}([^]*?){{endblock}}/g),
    statement:  (/{{\s*((?!}}).+?)\s*}}/g),
    if:         (/^if\s+([^]*)$/),
    elseIf:     (/^else\s+if\s+([^]*)$/),
    else:       (/^else$/),
    for:        (/^for\s+([$A-Za-z_][0-9A-Za-z_]*)(?:\s*,\s*([$A-Za-z_][0-9A-Za-z_]*))?\s+in\s+(.*)$/),
    each:       (/^each\s+([$A-Za-z_][0-9A-Za-z_]*)(?:\s*,\s*([$A-Za-z_][0-9A-Za-z_]*))?\s+in\s(.*)$/),
    end:        (/^end$/)
  };

  const parse = {
    include:    (_, path) => `_buffer += compiled("${cache[lookup(path)]}", _data)(_data)`,
    includeFn:  (_, __, path, data) => `_buffer += compiled("${cache[lookup(path)]}", _data)({${data}})`,
    block:      (_, varname, content) => `{{:var ${varname} = compiled("${content}", _data)(_data)}}{{:_data["${varname}"] = ${varname}}}`,
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
      var length = 'length' + iterator++;
      return `for (var ${iter} = 0, ${length} = ${array}.length; ${iter} < ${length}; ${iter}++) { var ${value} = ${array}[${(iter)}];`;
    }
  };

  function parser(match, inner) {
    const prev = inner;
    inner = inner
      .replace(exps.include, parse.include)
      .replace(exps.includeFn, parse.includeFn)
      .replace(exps.end, parse.end)
      .replace(exps.else, parse.else)
      .replace(exps.elseIf, parse.elseIf)
      .replace(exps.if, parse.if)
      .replace(exps.each, parse.each)
      .replace(exps.for, parse.for);

    return `"; ${(inner === prev && !/^:/.test(inner) ? ' _buffer += ' : '')} ${inner.replace(/\t|\n|\r|^:/, '')}; _buffer += "`;
  }

  function compiled(str, data) {
    let key = hash(str);

    if (!compiledCache[key]) {
      compiledCache[key] = compile(str);
    }

    return compiledCache[key];
  }

  function hash(str) {
    let hash = 5381;
    let i = str.length;

    while(i) {
      hash = (hash * 33) ^ str.charCodeAt(--i);
    }

    return hash >>> 0;
  }

  function compile(str) {
    let layout;

    str = str
      .replace(exps.extends, (_, path) => {
        layout = cache[lookup(path)];
        return '';
      })
      .replace(new RegExp('\\\\', 'g'), '\\\\').replace(/"/g, '\\"')
      .replace(exps.block, parse.block)
      .replace(exps.statement, parser)
      .replace(/_buffer_\s\+=\s"";/g, '')
      .replace(/(\{|\});/g, '$1')
      .replace(/\n/g, '\\n')
      .replace(/\t/g, '\\t')
      .replace(/\r/g, '\\r');

    let fn = `
      function _compiledTemplate(_data){
        var _buffer = "";

        function _valForEval(val) {
          if (typeof val == 'function') return val.toString();
          return JSON.stringify(val);
        }

        for (var prop in _data) {
          if (_data.hasOwnProperty(prop)) {
            eval("var " + prop + " = " + _valForEval(_data[prop]));
          }
        }
        _buffer += "${str}";
    `;

    if (layout) {
      fn += `
        _data['view'] = _buffer;
        _buffer = compiled("${layout}", _data)(_data);
      `;
    }

    fn += `
        return _buffer;
      }
    `;

    try {
      eval(fn);
      return _compiledTemplate.bind(_compiledTemplate);
    } catch (e) {
      throw new Error(`Compilation error: ${fn}`);
    }
  }

  return new Beard();
};
