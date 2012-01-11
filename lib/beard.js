
var iterator = 0;

var exps = {
	'statement':	(/\{\s*([^}]+?)\s*\}/g),
	'operators': 	(/\s+(and|or|eq|neq)\s+/),
	'if': 			(/^if\s+(.*)$/),
	'elseif': 		(/^else\s+if\s+(.*)$/),
	'else': 		(/^else$/),
	'for': 			(/^for\s+([$A-Za-z_][0-9A-Za-z_]*)(?:\s*,\s*([$A-Za-z_][0-9A-Za-z_]*))?\s+in\s+(.*)$/),
	'each': 		(/^each\s+([$A-Za-z_][0-9A-Za-z_]*)(?:\s*,\s*([$A-Za-z_][0-9A-Za-z_]*))?\s+in\s(.*)$/),
	'end':			(/^end$/)
}

var operators = {
	and: 			' && ',
	or: 			' || ',
	eq: 			' === ',
	neq: 			' !== ',
	not: 			' !'
}

var parse = {
	
	operators: function(_, op){
		return operators[op];
	},

	if: function(_, state){
		return 'if (' + state + ') {';
	},

	elseif: function(_, state){
		return '} else if (' + state +') {';
	},

	else: function(){
		return '} else {';
	},

	for: function(_, key, value, object){
		if (!value) key = (value = key, 'iterator' + iterator++);
		return 'for (var ' + key + ' in ' + object + '){' + 'var ' + value + ' = ' + object + '[' + key +'];';
	},

	each: function(_, iter, value, array){
		if (!value) iter = (value = iter, 'iterator' + iterator++);
		return 'for (var ' + iter + ' = 0, l = ' + array + '.length; ' + iter + ' < l; ' + iter + '++) {' + 'var ' + value + ' = ' + array + '[' + (iter) + '];';
	},

	end: function(){
		return '}';
	}

}

var parser = function(match, inner){
	var prev = inner;

	inner = inner.replace(exps.operators, parse.operators)
		.replace(exps.end, parse.end)
		.replace(exps.else, parse.else)
		.replace(exps.elseif, parse.elseif)
		.replace(exps.if, parse.if)
		.replace(exps.each, parse.each)
		.replace(exps.for, parse.for);

	return '";' + (inner == prev ? ' _buffer += ' : '') + inner.replace(/\t|\n|\r/, '') + '; _buffer += "';
}

var compiler = function(str){
	str = str.replace(new RegExp('\\\\', 'g'), '\\\\').replace(/"/g, '\\"');

	var fn = ('var _buffer = ""; with (data){ _buffer += "' + str.replace(exps.statement, parser) + '"; return _buffer; }')
		.replace(/_buffer\s\+\=\s"";/, '')
		.replace(/(\{|\});/g, '$1')
		.replace('_buffer += "";', '')
		.replace(/\n/g, '\\n')
		.replace(/\t/g, '\\t')
		.replace(/\r/g, '\\r');

	// create the function
	try {
		return new Function('data', fn);
	} catch(e){
		throw new Error('Cant compile template:' + fn);
	}
}

var render = function(template, view){
	return compiler(template)(view);
}

module.exports = render;