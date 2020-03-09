const { time } = require('brisky-performance');
const beard = require('./lib/index');

const benchmarkTemplate = function(name, path, engine, data = {}) {
  let start;
  let elapsed;

  const times = 100000;

  console.log('--');
  console.log(name);

  engine.render(path, data);

  start = time();
  for(i = 0; i < times; i++) engine.render(path, data);
  elapsed = time(start);
  console.log(`Rendering ${times} times with caching took ${elapsed}ms to complete.`);

  console.log('\n');
}

benchmarkTemplate('Simple Content', 'content', beard({
  templates: {
    '/content': 'some content'
  }
}));

benchmarkTemplate(
  'Page with Layout',
  'page',
  beard({
    templates: {
      '/nav': "{{foo}} {{boo}}",
      '/page': "{{extends 'layout'}}page content{{block header}}the header{{endblock}} {{include 'nav', { foo: 'hello', boo: 'nacho'}}}",
      '/layout': 'top of page {{header}} -- {{content}} -- the footer'
    }
  })
);

benchmarkTemplate(
  'Escaped Content',
  'escape',
  beard({
    templates: {
      '/escape': "{{:'<script>alert('this\'')</script>'}"
    }
  })
);



benchmarkTemplate(
  'Full Templates',
  'view',
  beard({
    templates: {
      '/layout': `
      im inside layout
      {{each name in names}}
        {{name}}
      {{end}}
      {{insidePartialBlock}}
      {{content}}
    `,
    '/sublayout': `
      {{extends 'layout'}}
      im in sublayout
      {{content}}
      {{foo}}
    `,
    '/view': `
      {{extends 'sublayout'}}
      im the view
      {{block foo}}
      im in foo block
      {{include 'partial', {key: value}}}
      {{endblock}}
    `,
    '/partial': `
      {{if key == 'a'}}
        {{block insidePartialBlock}}
          first partialblock
        {{endblock}}
      {{else if key == 'b'}}
        {{block insidePartialBlock}}
          second partialblock
        {{endblock}}
      {{else}}
        {{block insidePartialBlock}}
          third partialblock
        {{endblock}}
      {{end}}
    `
    }
  }),
  {names: ['Jack', 'Black', 'John'], value: 'b'}
);
