const { time } = require('brisky-performance');
const beard = require('./beard');

const benchmarkTemplate = function(name, template, beardInstance, times = 10000) {
  let start;
  let elapsed;

  console.log(name);
  console.log('--');

  beardInstance.render(template)

  start = time();
  for(i = 0; i < times; i++) beardInstance.render(template);
  elapsed = time(start);
  console.log(`Rendering ${times} times with caching took ${elapsed}ms to complete.`);

  console.log('\n');
}

benchmarkTemplate('Simple Content', 'some content', beard({}));

benchmarkTemplate(
  'Page with Layout',
  "{{include 'page'}}",
  beard({
    'page': "{{extends 'layout'}}page content{{block header}}the header{{endblock}}",
    'layout': 'top of page {{header}} -- {{view}} -- the footer'
  })
);

benchmarkTemplate(
  'Page with Layout with Path Lookup',
  "{{include 'page'}}",
  beard({
    '/views/page': "{{extends 'layout'}}page content{{block header}}the header{{endblock}}",
    '/views/layout': 'top of page {{header}} -- {{view}} -- the footer'
  },
    (path) => `/views/${path}`
  )
);
