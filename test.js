const { expect } = require('chai');

const beard = require('./beard');

describe('Beard Rendering', function() {
  it('renders content', function() {
    const engine = beard({
      'content': 'some content'
    });
    expect(engine.render('content')).to.equal('some content');
  });

  it('includes templates', function() {
    const engine = beard({
      'content': 'some content',
      'view': `header {{include 'content'}} footer`
    });
    expect(engine.render('view')).to.
      equal('header some content footer');
  });

  it('renders blocks', function() {
    const engine = beard({
      'block': '{{block footer}}a footer{{endblock}}some info - {{footer}}'
    });
    expect(engine.render('block')).to.equal('some info - a footer');
  });

  it('extends layouts', function() {
    const engine = beard({
      'view': `
        {{extends 'layout'}}
        page content
        {{block nav}}
          main navigation
        {{endblock}}
      `,
      'layout': `
        header
        {{nav}}
        -
        {{view}}
        footer
      `
    });
    expect(engine.render('view').replace(/\s+/g, ' ')) // replacing excessive whitespace for readability
      .to.equal(` header main navigation - page content footer `);
  });

  it('handles for loops', function() {
    const engine = beard({
      'view': 'names = {{for name in names}} {{name}}{{end}}'
    });
    expect(engine.render('view', {names: ['Bill', 'John', 'Dave']})).to.equal('names =  Bill John Dave');
  });

  it('handles each loops', function() {
    const engine = beard({
      'each': 'people = {{each person in people}}{{person.name.first}} {{person.name.last}}! {{end}}'
    });
    const people = [
      {
        name: {
          first: 'Charles',
          last: 'Spurgeon'
        }
      },
      {
        name: {
          first: 'John',
          last: 'Calvin'
        }
      }
    ];
    expect(engine.render('each', {people: people})).to.equal('people = Charles Spurgeon! John Calvin! ');
  });

  it('handles conditionals', function() {
    const engine = beard({
      'with': `
        {{extends 'layout'}}
        {{if navigation === 'full'}}
          {{block nav}}full navigation{{endblock}}
        {{else if navigation === 'sub'}}
          {{block nav}}subnavigation{{endblock}}
        {{else}}
          {{block nav}}no nav{{endblock}}
        {{end}}
        {{nav}}
      `,
      'layout': `
        header
        {{nav}}
        -
        {{view}}
        footer
      `
    });
    expect(engine.render('with', {navigation: 'full'})).to.include('full navigation');
    expect(engine.render('with', {navigation: 'sub'})).to.include('subnavigation');
    expect(engine.render('with', {navigation: 'none'})).to.include('no nav');
  });

  it('handles strings', function() {
    const engine = beard({
      'content': '{{content}}'
    });
    expect(engine.render('content', {content: 'some content'})).to.equal('some content');
  });

  it('handles numbers', function() {
    const engine = beard({
      'value': '{{value}}'
    });
    expect(engine.render('value', {value: 36})).to.equal('36');
  });

  it('handles arrays', function() {
    const engine = beard({
      'arrays': '{{each name in names}}{{name}} {{end}}'
    });
    expect(engine.render('arrays', {names: ['John Calvin', 'Charles Spurgeon']}))
      .to.equal('John Calvin Charles Spurgeon ');
  });

  it('handles arrays of objects', function() {
    const engine = beard({
      'arrays': '{{each person in people}}{{person.name}} {{end}}'
    });
    const data = {
      people: [
        {
          name: 'John Knox'
        },
        {
          name: 'Charles Spurgeon'
        },
        {
          name: 'John Owen'
        }
      ]
    };
    expect(engine.render('arrays', data)).to.equal('John Knox Charles Spurgeon John Owen ');
  });

  it('handles functions', function() {
    const engine = beard({
      'function': '{{add(3, 10)}}'
    });
    expect(engine.render('function', {add: (x, y) => x + y})).to.equal('13');
  });

  it('handles objects', function() {
    const engine = beard({
      'object': '{{resource.slug}}'
    });
    const data = {
      resource: {
        slug: 'the-most-interesting-article'
      }
    };
    expect(engine.render('object', data)).to.include('the-most-interesting-article');
  });

  it('handles null values', function() {
    const engine = beard({
      'null_value': '{{value}}'
    });
    expect(engine.render('null_value', {value: null})).to.equal('null');
  });

  it('handles undefined values', function() {
    const engine = beard({
      'undefined_value': '{{value}}'
    });
    expect(engine.render('undefined_value', {value: undefined})).to.equal('undefined');
  });

  it('handles sublayouts', function() {
    const engine = beard({
      'layout': 'header | {{view}} | footer',
      'sublayout': "{{extends 'layout'}}{{sidebar}} | {{view}} | {{main}}",
      'view': "{{include 'partial'}}",
      'partial': "{{extends 'sublayout'}}{{block main}}main{{endblock}}{{block sidebar}}sidebar{{endblock}}hi im view"
    });
    expect(engine.render('view')).to.equal('header | sidebar | hi im view | main | footer');
  });

  it('handles passing data to includes', function() {
    const engine = beard({
      'view': `{{include('item', {title: '1st', item: 1})}}, {{include('item', {title: '2nd', item: 2})}}`,
      'item': '{{title}} | {{item}}'
    });
    expect(engine.render('view')).to.equal('1st | 1, 2nd | 2');
  });

  it('ignores inline css and js', function() {
    const engine = beard({
      'template': `
        <style>
        .hello {
          background-color: #f33
        }
        </style>

        <script>
        function inlineScript() {
          var obj = {
            name: 'Jack Black'
          };

          console.log(obj);
        }
        </script>
      `
    });
    expect(engine.render('template')).to.equal(`
        <style>
        .hello {
          background-color: #f33
        }
        </style>

        <script>
        function inlineScript() {
          var obj = {
            name: 'Jack Black'
          };

          console.log(obj);
        }
        </script>
      `);
  });

  it('handles nested template data', function() {
    const engine = beard({
      'layout': `
        im inside layout
        {{each name in names}}
          {{name}}
        {{end}}
        {{insidePartialBlock}}
        {{view}}
      `,
      'sublayout': `
        {{extends 'layout'}}
        im in sublayout
        {{view}}
        {{foo}}
      `,
      'view': `
        {{extends 'sublayout'}}
        im the view
        {{block foo}}
        im in foo block
        {{include('partial', {key: value})}}
        {{endblock}}
      `,
      'partial': `
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
    });
    expect(engine.render('view', {names: ['Jack', 'Black', 'John'], value: 'b'}).replace(/\s+/g, ' ')).to
      .equal(' im inside layout Jack Black John second partialblock im in sublayout im the view im in foo block ');
  });
});

describe('Beard Path Lookup', function() {
  const beardInstance = beard({
    '/views/content': 'view content',
    '/views/item': '{{title}} | {{item}}',
    '/views/list': `{{include('item', {title: '1st', item: 1})}}, {{include('item', {title: '2nd', item: 2})}}`
  }, (path) => `/views/${path}`);

  it('processes the path', function() {
    expect(beardInstance.render('content')).to.equal('view content');
  });

  it('handles passing data to includes', function() {
    expect(beardInstance.render('list')).to.equal('1st | 1, 2nd | 2');
  });
});
