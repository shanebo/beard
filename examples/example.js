const http = require('http');
const fs = require('fs');
const Beard = require('../beard');
const engine = new Beard();
const template = fs.readFileSync(__dirname + '/example.beard', 'utf8');

const data = {
  page: {
    title: 'Grow a Beard'
  },
  index: {
    yo: {
      name: {
        first: 'Charles',
        last: 'Spurgeon'
      }
    },
    mama: {
      name: {
        first: 'John',
        last: 'Calvin'
      }
    }
  },
  names: [
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
  subhead: 'Beard Examples',
  nacho: 'foo',
  cats: ['jack', 'black', 'attack'],
  makeUpperCase: str => str.toUpperCase()
};

const html = engine.render(template, data);
console.log('\n');
console.log(html);

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(html);
}).listen(5555);

console.log('Server running at http://127.0.0.1:5555/');
