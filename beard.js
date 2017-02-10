(function(){

var Beard = function(cache){
    this._cache = cache;
}
var iterator = 0;
var keeps = {};
var keepId = 0;

var exps = {
    extend: (/{extend\s(.*?)}/),
    include: (/{include\s(.*?)}/g),
    block: (/{block\s+(.[^}]*)}([^]*?){endblock}/g),
    keep: (/{keep}([^]*?){endkeep}/g),
    keepTemp: (/_keep_([^]*?)_endkeep_/g),
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

    keep: function(_, contents) {
        keepId += 1;
        keeps[keepId] = contents;
        return '_keep_' + keepId + '_endkeep_';
    },

    keepTemp: function(_, id) {
        return keeps[id];
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

Beard.prototype = {

    parser: function(match, inner) {
        var prev = inner;
        inner = inner
            .replace(exps.operators, parse.operators)
            .replace(exps.end, parse.end)
            .replace(exps.else, parse.else)
            .replace(exps.elseIf, parse.elseIf)
            .replace(exps.if, parse.if)
            .replace(exps.each, parse.each)
            .replace(exps.for, parse.for);

        return '";' + (inner === prev ? ' _buffer += ' : '') + inner.replace(/\t|\n|\r/, '') + '; _buffer += "';
    },

    parseExtend: function(template, data) {
        var matches;
        template = template.replace(exps.extend, function(){
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
    },

    parseInclude: function(template, data) {
        return template.replace(exps.include, function(_, path){
            return this.preRender(this._cache['/views/' + path].body, data);
        }.bind(this));
    },

    parseBlock: function(template, data) {
        var matches = [];
        template = template.replace(exps.block, function(){
            var arr = ([]).slice.call(arguments, 0);
            matches.push(arr);
            return '';
        });

        matches.forEach(function(set){
            // set[1] is the var name;
            // set[2] is the var value;
            data[set[1]] = this.compile(set[2])(data);
        }.bind(this));

        return this.compile(template)(data);
    },

    preRender: function(template, data){
        template = template.replace(exps.keep, parse.keep);
        template = this.parseExtend(template, data);
        template = this.parseInclude(template, data);
        template = this.parseBlock(template, data);
        return this.compile(template)(data);
    },

    render: function(template, data){
        template = this.preRender(template, data);
        template = template.replace(exps.keepTemp, parse.keepTemp);
        console.log('keeps:');
        console.log(keeps);
        keepId = 0;
        keeps = {};
        return template;
    },

    compile: function(str) {
        str = str
            .replace(new RegExp('\\\\', 'g'), '\\\\').replace(/"/g, '\\"')
            .replace(exps.statement, this.parser)
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
};


if (typeof module !== 'undefined') {
    module.exports = Beard;
} else {
    window.Beard = Beard;
}

})();
