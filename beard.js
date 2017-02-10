(function(){

var iterator = 0;
var keeps = {};
var id = 0;
var onIgnore = false;
var skipIgnore = true;
var skipKeep = true;

var exps = {
    // _extend: (/extend\s(\S+?)$/),
    include: (/{include\s(.*?)}/g),
    keep: (/{keep}([^]*?){endkeep}/g),
    block: (/{block\s+(.[^}]*)}([^]*?){endblock}/g),
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

    keep: function(_, contents) {
        id += 1;
        keeps[id] = contents;
        console.log('_keep_' + id + '_endkeep_');
        return '_keep_' + id + '_endkeep_';
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

function renderExtend(template, data) {
    var matches;
    template = template.replace(/{extend\s(.*?)}/, function(){
        matches = ([]).slice.call(arguments, 0);
        return '';
    });

    if (matches && matches.length) {
        var path = matches[1];
        var view = this._cache['/views/' + path].body;
        view = view.replace(exps.keep, parse.keep);
        view += "{block view}" + this.preRender(template, data) + "{endblock}";
        return view;
    } else {
        return template;
    }
}

function renderInclude(template, data) {
    return template.replace(exps.include, function(_, path){
        return this.partial(path, data);
    }.bind(this));
}

function renderBlocks(template, data) {
    var matches = [];
    template = template.replace(exps.block, function(){
        var arr = ([]).slice.call(arguments, 0);
        matches.push(arr);
        return '';
    });

    matches.forEach(function(set){
        // set[1] is the var name;
        // set[2] is the var value;
        data[set[1]] = compile(set[2])(data);
    });

    return compile(template)(data);
}

function parser(match, inner) {
    var prev = inner;

    console.log(match);
    console.log(inner);

    inner = inner
        // .replace(exps.keep, parse.keep)
        .replace(exps.operators, parse.operators)
        .replace(exps.end, parse.end)
        .replace(exps.else, parse.else)
        .replace(exps.elseIf, parse.elseIf)
        .replace(exps.if, parse.if)
        .replace(exps.each, parse.each)
        .replace(exps.for, parse.for);

    return '";' + (inner == prev ? ' _buffer += ' : '') + inner.replace(/\t|\n|\r/, '') + '; _buffer += "';
}

function compile(str) {
    str = str
        // .replace(exps.keep, parse.keep)
        .replace(new RegExp('\\\\', 'g'), '\\\\').replace(/"/g, '\\"')
        .replace(exps.statement, parser)
        .replace(/_buffer_\s\+=\s"";/g, '')
        .replace(/(\{|\});/g, '$1')
        .replace(/\n/g, '\\n')
        .replace(/\t/g, '\\t')
        .replace(/\r/g, '\\r');

    var fn = (
        'var _buffer = ""; \
         for (var prop in _data_) { \
            if (_data_.hasOwnProperty(prop)) this[prop] = _data_[prop]; \
         } \
         _buffer += "' + str + '"; \
         return _buffer;'
    );

    try {
        return new Function('_data_', fn);
    } catch (e) {
        throw new Error('Cant compile template:' + fn);
    }
}


var Beard = function(cache){
    this._cache = cache;
}

Beard.prototype = {

    partial: function(path, data){
        return this.preRender(this._cache['/views/' + path].body, data);
        // return this.render(this._cache['/views/' + path].body, data);
    },

    preRender: function(template, data){
        template = template.replace(exps.keep, parse.keep);
        // skipKeep = true;
        template = renderExtend.call(this, template, data);
        template = renderInclude.call(this, template, data);
        template = renderBlocks(template, data);
        // skipKeep = false;
        console.log('keeps:');
        console.log(keeps);
        template = compile(template)(data);
        return template;
        // return compile(template)(data);
    },

    render: function(template, data){
        skipKeep = true;
        template = this.preRender(template, data);
        skipKeep = false;
        console.log('keeps:');
        console.log(keeps);

        template = compile(template)(data);

        if (!skipKeep) {
            template = template.replace(/_keep_([^]*?)_endkeep_/g, function(_, keepId) {
                console.log('keepId: ' + keepId);
                return keeps[keepId];
            });
        }

        id = 0;
        keeps = {};
        return template;
        // return compile(template)(data);
    }

    // render: function(template, data){
    //     template = template.replace(exps.keep, parse.keep);
    //     skipKeep = true;
    //     template = renderExtend.call(this, template, data);
    //     template = renderInclude.call(this, template, data);
    //     template = renderBlocks(template, data);
    //     skipKeep = false;
    //     console.log('keeps:');
    //     console.log(keeps);
    //
    //     template = compile(template)(data);
    //
    //     if (!skipKeep) {
    //         template = template.replace(/_keep_([^]*?)_endkeep_/g, function(_, keepId) {
    //             console.log('keepId: ' + keepId);
    //             return keeps[keepId];
    //         });
    //     }
    //
    //     id = 0;
    //     keeps = {};
    //     return template;
    //     // return compile(template)(data);
    // }
};


if (typeof module !== 'undefined') {
    module.exports = Beard;
} else {
    window.Beard = Beard;
}

})();
