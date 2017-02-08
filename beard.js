(function(){

var iterator = 0;
var keeps = {};
var id = 0;
var onIgnore = false;
var skipIgnore = false;
var skipKeep = true;

var exps = {
    keep: (/{keep}([^]*?){endkeep}/g),
    block: (/{block\s+(.[^}]*)}([^]*?){endblock}/g),
    // _extend: (/extend\s(\S+?)$/),

    // include: (/include\s(\S+?)$/),

    statement: (/\{\s*([^}]+?)\s*\}/g),
    operators: (/\s+(and|or|eq|neq|is|isnt|not)\s+/g),
    if: (/^if\s+([^]*)$/),
    elseIf: (/^else\s+if\s+([^]*)$/),
    else: (/^else$/),
    for: (/^for\s+([$A-Za-z_][0-9A-Za-z_]*)(?:\s*,\s*([$A-Za-z_][0-9A-Za-z_]*))?\s+in\s+(.*)$/),
    each: (/^each\s+([$A-Za-z_][0-9A-Za-z_]*)(?:\s*,\s*([$A-Za-z_][0-9A-Za-z_]*))?\s+in\s(.*)$/),
    end: (/^end$/)
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

    // include: function(_, name) {
    //     return '_buffer += (_data_["' + name + '"] || "")';
    // },

    keep: function(_, statement) {
        console.log('statement:');
        console.log(statement);
        return 'YO KEEP THIS';
    },

    operators: function(_, op) {
        return operators[op];
    },

    if: function(_, statement) {
        return 'if (' + statement + ') {';
    },

    elseIf: function(_, statement) {
        return '} else if (' + statement +') {';
    },

    else: function() {
        return '} else {';
    },

    for: function(_, key, value, object) {
        if (!value) key = (value = key, 'iterator' + iterator++);
        return 'for (var ' + key + ' in ' + object + '){' + 'var ' + value + ' = ' + object + '[' + key +'];';
    },

    each: function(_, iter, value, array) {
        if (!value) iter = (value = iter, 'iterator' + iterator++);
        var length = 'length' + iterator++;
        return 'for (var ' + iter + ' = 0, ' + length + ' = ' + array + '.length; ' + iter + ' < ' + length + '; ' + iter + '++) {' + 'var ' + value + ' = ' + array + '[' + (iter) + '];';
    },

    end: function() {
        return '}';
    }
};

function parser(match, inner) {
    var prev = inner;

    console.log(match);
    console.log(inner);

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

    inner = inner
        // .replace(exps.keep, parse.keep)
        // .replace(exps.include, parse.include)
        // .replace(exps._extend, parse._extend)
        .replace(exps.operators, parse.operators)
        .replace(exps.end, parse.end)
        .replace(exps.else, parse.else)
        .replace(exps.elseIf, parse.elseIf)
        .replace(exps.if, parse.if)
        .replace(exps.each, parse.each)
        .replace(exps.for, parse.for);

    return '";' + (inner == prev ? ' _buffer += ' : '') + inner.replace(/\t|\n|\r/, '') + '; _buffer += "';
    // return '";' + (inner == prev ? ' _buffer += ' : '') + inner.replace(/\t|\n|\r/, '') + '; _buffer += "';
};

function compile(str) {
    // str = str.replace(new RegExp('\\\\', 'g'), '\\\\').replace(/"/g, '\\"');
    // var fn = ('var _buffer = ""; with (_data_){ _buffer += "' + str.replace(exps.statement, parser) + '"; return _buffer; }')


    str = str.replace(/{keep}([^]*?){endkeep}/g, function(_, contents) {
        id += 1;
        keeps[id] = contents;
        return '_keep_' + id + '_endkeep_';
    });

    // console.log(keeps);

    str = str
        .replace(new RegExp('\\\\', 'g'), '\\\\').replace(/"/g, '\\"')
        .replace(exps.statement, parser)
        .replace(/_buffer_\s\+=\s"";/g, '')
        // .replace(/_buffer\s\+\=\s"";/, '')
        // .replace('_buffer += "";', '')
        .replace(/(\{|\});/g, '$1')
        .replace(/\n/g, '\\n')
        .replace(/\t/g, '\\t')
        .replace(/\r/g, '\\r');

    // if (!skipKeep) {
    //     str = str.replace(/_keep_([^]*?)_endkeep_/g, function(_, keepId) {
    //         console.log('keepId: ' + keepId);
    //         return keeps[keepId];
    //     });
    // }

    var fn = (
        'var _buffer = ""; \
         for (var prop in _data_) { \
            if (_data_.hasOwnProperty(prop)) this[prop] = _data_[prop]; \
         } \
         _buffer += "' + str + '"; \
         return _buffer;'
    );

    // console.log(fn);


/*
    str = str
        .replace(new RegExp('\\\\', 'g'), '\\\\').replace(/"/g, '\\"')

    var fn = (
        'var _buffer = ""; \
        for (var prop in _data_) { \
            if (_data_.hasOwnProperty(prop)) this[prop] = _data_[prop]; \
        } \
        _buffer += "' + str.replace(exps.statement, parser) + '"; \
        return _buffer;'
    );

    fn
        .replace(/_buffer\s\+\=\s"";/, '')
        .replace(/(\{|\});/g, '$1')
        .replace('_buffer += "";', '')
        .replace(/\n/g, '\\n')
        .replace(/\t/g, '\\t')
        .replace(/\r/g, '\\r');
*/

    try {
        return new Function('_data_', fn);
    } catch (e) {
        throw new Error('Cant compile template:' + fn);
    }
};


var Beard = {

    renderBlocks: function(template, view){
        var matches = [];

        template = template.replace(exps.block, function(){
            var arr = ([]).slice.call(arguments, 0);
            matches.push(arr);
            return '';
        });

        skipIgnore = true;
        skipKeep = true;

        matches.forEach(function(set){
            // set[1] is the var name;
            // set[2] is the var content;
            view[set[1]] = compile(set[2])(view);
        });

        // skipIgnore = false;

        return compile(template)(view);
    },

    render: function(template, view){
        // var matches = [];
        //
        // template = template.replace(exps.block, function(){
        //     var arr = ([]).slice.call(arguments, 0);
        //     matches.push(arr);
        //     return '';
        // });
        //
        // skipIgnore = true;
        //
        // matches.forEach(function(set){
        //     // set[1] is the var name;
        //     // set[2] is the var content;
        //     view[set[1]] = compile(set[2])(view);
        // });


        // skipIgnore = true;
        // keeps = {};
        // id = 0;

        template = Beard.renderBlocks(template, view);
        skipIgnore = false;
        skipKeep = false;

        console.log('keeps:');
        console.log(keeps);


        template = compile(template)(view);

        if (!skipKeep) {
            template = template.replace(/_keep_([^]*?)_endkeep_/g, function(_, keepId) {
                console.log('keepId: ' + keepId);
                return keeps[keepId];
            });
        }

        // id = 0;
        // keeps = {};

        return template;

        // return compile(template)(view);
    }
    // ,
    //
    // __calvin = function(path, options, fn) {
    //     exports.renderFile(path, options, fn);
    // }
};


if (typeof module !== 'undefined') {
    module.exports = Beard;
} else {
    window.Beard = Beard;
}

})();
