const Beard = function() {

}

Beard.prototype = {
  render: (template, data) => compile(template)(data)
};

// should we reset the iterator to zero every time render is called so it doesnt build up too large?
let iterator = 0;

const exps = {
  include:    (/^include\s(.*?)$/g),
  block:      (/{block\s+(.[^}]*)}([^]*?){endblock}/g),
  statement:  (/\{\s*([^}]+?)\s*\}/g),
  if:         (/^if\s+([^]*)$/),
  elseIf:     (/^else\s+if\s+([^]*)$/),
  else:       (/^else$/),
  for:        (/^for\s+([$A-Za-z_][0-9A-Za-z_]*)(?:\s*,\s*([$A-Za-z_][0-9A-Za-z_]*))?\s+in\s+(.*)$/),
  each:       (/^each\s+([$A-Za-z_][0-9A-Za-z_]*)(?:\s*,\s*([$A-Za-z_][0-9A-Za-z_]*))?\s+in\s(.*)$/),
  end:        (/^end$/)
};

const parse = {
  include:    (_, path) => `_buffer += compile("${_cache[path]}")(_data_)`, // eventually we'll need to add support to pass in a _cache object
  block:      (_, varname, content) => `{:var ${varname} = compile("${content}")(_data_)}`,
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
    .replace(exps.end, parse.end)
    .replace(exps.else, parse.else)
    .replace(exps.elseIf, parse.elseIf)
    .replace(exps.if, parse.if)
    .replace(exps.each, parse.each)
    .replace(exps.for, parse.for);

  return `"; ${(inner === prev && !/^:/.test(inner) ? ' _buffer += ' : '')} ${inner.replace(/\t|\n|\r|:/, '')}; _buffer += "`;
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
      return _buffer;
    }
  `;

  console.log('\n');
  console.log(fn);

  try {
    eval(fn);
    return _compiledTemplate_;
  } catch (e) {
    throw new Error(`Compilation error: ${fn}`);
  }
}

module.exports = Beard;




// This is a template cache so you can test partials, blocks, layouts and such

let _cache = {
  'partials/joe': "<h1>Hello, my name is {name} {if name == 'Joe'}{include partials/lastname}{end}</h1>",
  'partials/complex-test': '{block doitlive}{include partials/joe}{endblock} -- outside block -- {doitlive}',
  'foobar': '{block nice}inside block{endblock} -- outside block -- {nice}',
  'partials/lastname': 'Osburn and I\'m {include partials/winning}',
  'partials/js': "yo {true ? 'true' : 'not true'}",
  'partials/winning': 'winning with Shane.'
};

// These are direct template tests so you don't have to do it in beard files for now

console.log(compile("{include partials/js}", {}));

console.log(compile("{include partials/joe}")({
  name: 'Joe'
}));

console.log(compile("{include foobar}")({}));

// this one isn't working
// console.log(compile("{include partials/complex-test}")({
//   name: 'Shane'
// }));
