

var http = require('http');
var fs = require('fs');
var Beard = require('beard');


http.createServer(function (request, response) {
	response.writeHead(200, {'Content-Type': 'text/html'});

	fs.readFile(__dirname + '/example.html', 'UTF-8', function(err, template){
		if (err) throw err;
		var view = {
			hello: {
				world: 'waaassssuupp...'
			},
			collection: [
				{
					name: { first: 'Jack', last: 'Black' }
				},
				{
					name: { first: 'Chuck', last: 'Norris' }
				}
			],
			a: 'mark',
			b: 'foo',
			cats: ['jack','black','attack'],
			makeUpperCase: function(str){
				return str.toUpperCase();
			}
		};
		var html = Beard.render(template, view);
		response.end(html);
	});

}).listen(5555);

console.log('Server running at http://127.0.0.1:5555/');