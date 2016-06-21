var iterator = 0;
var ignore = false;

var exps = {
    _statement: (/\{\s*([^}]+?)\s*\}/g),
    _operators: (/\s+(and|or|eq|neq|is|isnt|not)\s+/g),
    _if: (/^if\s+([^]*)$/),
    _elseif: (/^else\s+if\s+([^]*)$/),
    _else: (/^else$/),
    _for: (/^for\s+([$A-Za-z_][0-9A-Za-z_]*)(?:\s*,\s*([$A-Za-z_][0-9A-Za-z_]*))?\s+in\s+(.*)$/),
    _each: (/^each\s+([$A-Za-z_][0-9A-Za-z_]*)(?:\s*,\s*([$A-Za-z_][0-9A-Za-z_]*))?\s+in\s(.*)$/),
    _end: (/^end$/)
};

var operators = {
    and: ' && ',
    or: ' || ',
    eq: ' === ',
    neq: ' !== ',
    not: ' !',
    isnt: ' != ',
    is: ' == '
};

var parse = {
    
    _operators: function(_, op){
        return operators[op];
    },

    _if: function(_, state){
        return 'if (' + state + ') {';
    },

    _elseif: function(_, state){
        return '} else if (' + state +') {';
    },

    _else: function(){
        return '} else {';
    },

    _for: function(_, key, value, object){
        if (!value) key = (value = key, 'iterator' + iterator++);
        return 'for (var ' + key + ' in ' + object + '){' + 'var ' + value + ' = ' + object + '[' + key +'];';
    },

    _each: function(_, iter, value, array){
        if (!value) iter = (value = iter, 'iterator' + iterator++);
        var length = 'length' + iterator++;
        return 'for (var ' + iter + ' = 0, ' + length + ' = ' + array + '.length; ' + iter + ' < ' + length + '; ' + iter + '++) {' + 'var ' + value + ' = ' + array + '[' + (iter) + '];';
    },

    _end: function(){
        return '}';
    }

};

var parser = function(match, inner){
    var prev = inner;

    switch (true) {
        case (match == '{ignore}'):
            ignore = true;
            return '';
        case (ignore && match == '{endignore}'):
            ignore = false;
            return '';
        case (ignore):
            return match;
    }

    inner = inner
        .replace(exps._operators, parse._operators)
        .replace(exps._end, parse._end)
        .replace(exps._else, parse._else)
        .replace(exps._elseif, parse._elseif)
        .replace(exps._if, parse._if)
        .replace(exps._each, parse._each)
        .replace(exps._for, parse._for);

    return '";' + (inner == prev ? ' _buffer += ' : '') + inner.replace(/\t|\n|\r/, '') + '; _buffer += "';
};

var compiler = function(str){
    str = str.replace(new RegExp('\\\\', 'g'), '\\\\').replace(/"/g, '\\"');

    var fn = ('var _buffer = ""; with (data){ _buffer += "' + str.replace(exps._statement, parser) + '"; return _buffer; }')
        .replace(/_buffer\s\+\=\s"";/, '')
        .replace(/(\{|\});/g, '$1')
        .replace('_buffer += "";', '')
        .replace(/\n/g, '\\n')
        .replace(/\t/g, '\\t')
        .replace(/\r/g, '\\r');

    try {
        return new Function('data', fn);
    } catch(e) {
        throw new Error('Cant compile template:' + fn);
    }
};

Beard = {

    render: function(template, view){
        return compiler(template)(view);
    }

};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Beard;
}
