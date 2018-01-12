module.exports = function(cache = {}) {
  let compiledCache = {};
  let iterator = 0;

  const Beard = function() {}

  Beard.prototype = {
    render: (template, data = { cache: true }) => {
      iterator = 0;
      let layout;
      data.view = compiled(template, data)(data)
        .replace(/!!%%(.+)%%!!/, (_, path) => {
          layout = cache[path];
          return '';
        });

      return layout ? compiled(layout, data)(data) : data.view;
    }
  };

  const exps = {
    extend:     (/^extend\s(.*?)$/g),
    include:    (/^include\s(.*?)$/g),
    block:      (/{{block\s+(.[^}]*)}}([^]*?){{endblock}}/g),
    statement:  (/\{{\s*([^}}]+?)\s*\}}/g),
    if:         (/^if\s+([^]*)$/),
    elseIf:     (/^else\s+if\s+([^]*)$/),
    else:       (/^else$/),
    for:        (/^for\s+([$A-Za-z_][0-9A-Za-z_]*)(?:\s*,\s*([$A-Za-z_][0-9A-Za-z_]*))?\s+in\s+(.*)$/),
    each:       (/^each\s+([$A-Za-z_][0-9A-Za-z_]*)(?:\s*,\s*([$A-Za-z_][0-9A-Za-z_]*))?\s+in\s(.*)$/),
    end:        (/^end$/)
  };

  const parse = {
    extend:     (_, path) => `_buffer += "!!%%${path}%%!!"`,
    include:    (_, path) => `_buffer += compiled("${cache[path]}", _data_)(_data_)`,
    block:      (_, varname, content) => `{{:var ${varname} = compiled("${content}", _data_)(_data_)}}{{:_data_["${varname}"] = ${varname}}}`,
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
      .replace(exps.extend, parse.extend)
      .replace(exps.include, parse.include)
      .replace(exps.end, parse.end)
      .replace(exps.else, parse.else)
      .replace(exps.elseIf, parse.elseIf)
      .replace(exps.if, parse.if)
      .replace(exps.each, parse.each)
      .replace(exps.for, parse.for);

    return `"; ${(inner === prev && !/^:/.test(inner) ? ' _buffer += ' : '')} ${inner.replace(/\t|\n|\r|:/, '')}; _buffer += "`;
  }

  function compiled(str, data) {
    if (!data.cache) return compile(str);

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
    str = str
      .replace(new RegExp('\\\\', 'g'), '\\\\').replace(/"/g, '\\"')
      .replace(exps.block, parse.block)
      .replace(exps.statement, parser)
      .replace(/_buffer_\s\+=\s"";/g, '')
      .replace(/(\{|\});/g, '$1')
      .replace(/\n/g, '\\n')
      .replace(/\t/g, '\\t')
      .replace(/\r/g, '\\r');

    const fn = `
      function _compiledTemplate_(_data_){
        var _buffer = "";
        for (var prop in _data_) {
          if (_data_.hasOwnProperty(prop)) {
            this[prop] = _data_[prop];
          }
        }
        _buffer += "${str}";
        for (var prop in _data_) {
          if (_data_.hasOwnProperty(prop)) {
            delete this[prop];
          }
        }
        return _buffer;
      }
    `;

    // console.log('\n');
    // console.log(fn);

    try {
      eval(fn);
      return _compiledTemplate_;
    } catch (e) {
      throw new Error(`Compilation error: ${fn}`);
    }
  }

  return new Beard();
};
