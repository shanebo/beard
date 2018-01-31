const { time } = require('brisky-performance');
const beard = require('./beard');

const benchmarkTemplate = function(name, path, engine, times = 10000) {
  let start;
  let elapsed;

  console.log(name);
  console.log('--');

  engine.render(path);

  start = time();
  for(i = 0; i < times; i++) engine.render(path);
  elapsed = time(start);
  console.log(`Rendering ${times} times with caching took ${elapsed}ms to complete.`);

  console.log('\n');
}

benchmarkTemplate('Simple Content', 'content', beard({'/content': 'some content'}));

benchmarkTemplate(
  'Page with Layout',
  'page',
  beard({
    '/page': "{{extends 'layout'}}page content{{block header}}the header{{endblock}}",
    '/layout': 'top of page {{header}} -- {{view}} -- the footer'
  })
);
