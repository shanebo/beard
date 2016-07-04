(function(context){

var iterator = 0;
var onIgnore = false;
var skipIgnore = false;

var exps = {
    _block: (/{block\s+'(.[^}]*)'}([^]*?){endblock}/g),
    _include: (/include\s(\S+?)$/),
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

    _include: function(_, name){
        var str = '_buffer += (_data_["'+ name +'"] || "")';
        console.log(str);
        return str;
    },

    _operators: function(_, op){
        return operators[op];
    },

    _if: function(_, statement){
        return 'if (' + statement + ') {';
    },

    _elseif: function(_, statement){
        return '} else if (' + statement +') {';
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
            onIgnore = true;
            return skipIgnore ? match : '';
        case (onIgnore && match == '{endignore}'):
            onIgnore = false;
            return skipIgnore ? match : '';
        case (onIgnore):
            return match;
    }

    // if ((/{include\s([^}]+?)\s*}/g).test(match)) {
    //     console.log('inner: ' + inner);
    //     console.log('match: ' + match);
    //     inner = parse._include('', inner.replace('include ', ''));
        // return parse._include('', inner.replace('include ', ''));
    // }

    inner = inner
        .replace(exps._include, parse._include)
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

    var fn = ('var _buffer = ""; with (_data_){ _buffer += "' + str.replace(exps._statement, parser) + '"; return _buffer; }')
    // var fn = ('var _buffer = ""; for (var prop in _data_) { if (_data_.hasOwnProperty(prop)) this[prop] = _data_[prop] } _buffer += "' + str.replace(exps._statement, parser) + '"; return _buffer;')
        .replace(/_buffer\s\+\=\s"";/, '')
        .replace(/(\{|\});/g, '$1')
        .replace('_buffer += "";', '')
        .replace(/\n/g, '\\n')
        .replace(/\t/g, '\\t')
        .replace(/\r/g, '\\r');

    try {
        return new Function('_data_', fn);
    } catch (e) {
        throw new Error('Cant compile template:' + fn);
    }
};

// String.prototype.matchAll = function(regexp) {
//     var matches = [];
//     this.replace(regexp, function(){
//         var arr = ([]).slice.call(arguments, 0);
//         matches.push(arr);
//     });
//     return matches.length ? matches : null;
// };

var Beard = {

    render: function(template, view){
        var matches = [];

        template = template.replace(exps._block, function(){
            var arr = ([]).slice.call(arguments, 0);
            matches.push(arr);
            return '';
        });

        skipIgnore = true;
        matches.forEach(function(set){
            // set[1] is the var name;
            // set[2] is the var content;
            view[set[1]] = compiler(set[2])(view);
        });

        skipIgnore = false;
        return compiler(template)(view);
    }
};


if (typeof module !== 'undefined') {
    module.exports = Beard;
} else {
    this.Beard = Beard;
}


// context.slab = {
//     compile: compile,
//     parse: parse,
//     generate: generate
// };

})(typeof exports != 'undefined' ? exports : this);
