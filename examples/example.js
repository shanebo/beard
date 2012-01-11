

var http = require('http');
var fs = require('fs');
var beard = require('./beard');


http.createServer(function (req, res) {
	res.writeHead(200, {'Content-Type': 'text/html'});

	var view = {

		hello: {
			world: 'waaassssuupp...'
		},

		collection: [
			{
				name: { 
					first: 'Shane',
					last: 'Thacker'
				}
			},
			{
				name: { 
					first: 'Jack',
					last: 'Black'
				}
			},
			{
				name: { 
					first: 'Chuck',
					last: 'Norris'
				}
			}
		],

		a: 'mark',

		b: 'foo',

		cats: ['jack','black','attack'],

		makeUpperCase: function(str){
			return str.toUpperCase();
		}

	}

	var template = fs.readFileSync(__dirname + '/example.html', 'UTF-8');
	var html = beard(template, view);

	res.end(html);

}).listen(5555);

console.log('Server running at http://127.0.0.1:5555/');
