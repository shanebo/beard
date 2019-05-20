const { expect } = require('chai');
const normalize = require('path').normalize;
const fs = require('fs');

const beard = require('../beard');

describe('Beard Rendering', function() {
  it('renders content', function() {
    const engine = beard({
      templates: {
        '/content': 'some content'
      }
    });
    expect(engine.render('content')).to.equal('some content');
  });

  it('handles errors', function() {
    const engine = beard({
      templates: {
        '/content': '{{foo}}}'
      }
    });
    expect(() => engine.render('content', {foo: 'value'})).to.throw(/\"\{\{foo\}\}\}\" in \/content on line 1/);
  });

  it('includes templates', function() {
    const engine = beard({
      templates: {
        '/content': 'some content',
        '/view': `header {{include 'content'}} footer`
      }
    });
    expect(engine.render('view')).to.equal('header some content footer');
  });

  it('includes templates with dynamic paths', function() {
    const engine = beard({
      templates: {
        '/view': "header {{include partial}} {{include `/includes/${support}`}} {{include `/includes/${other.replace('_', '-')}`}}",
        '/includes/content': 'Partial Content',
        '/includes/footer': 'Footer',
        '/includes/other-content': 'Content!'
      }
    });
    expect(engine.render('view', {partial: '/includes/content', support: 'footer', other: 'other_content'}))
      .to.equal('header Partial Content Footer Content!');
  });

  it('renders blocks', function() {
    const engine = beard({
      templates: {
        '/block': '{{block footer}}a footer{{endblock}}some info - {{footer}}'
      }
    });
    expect(engine.render('block')).to.equal('some info - a footer');
  });

  it('renders blocks inside blocks', function() {
    const engine = beard({
      templates: {
        '/block': `
          {{block footer}}
            a footer
            {{block sub}}
              sub{{block name}}bill{{endblock}}info
            {{endblock}}
          {{endblock}}
          {{footer}} -- {{name}} -- {{sub}}`
      }
    });
    expect(engine.render('block').replace(/\s+/g, ' ')).to.equal(' a footer -- bill -- subinfo ');
  });

  it('extends layouts', function() {
    const engine = beard({
      templates: {
        '/view': `
          {{extends 'layout'}}
          page content
          {{block nav}}
            main navigation
          {{endblock}}
        `,
        '/layout': `
          header
          {{nav}}
          -
          {{content}}
          footer
        `
      }
    });
    expect(engine.render('view').replace(/\s+/g, ' ')) // replacing excessive whitespace for readability
      .to.equal(` header main navigation - page content footer `);
  });

  it('extends layouts with dynamic paths', function() {
    const engine = beard({
      templates: {
        '/view': '{{extends layout}}page',
        '/base': 'header {{put content}} footer',
        '/page': '{{extends `/layouts/${layout}`}}the page',
        '/layouts/simple': 'a layout {{put content}} bottom',
        '/content': "{{extends layout.replace('_', '-')}}content",
        '/base-layout': 'header {{put content}} footer'
      }
    });
    expect(engine.render('view', {layout: 'base'})).to.equal('header page footer');
    expect(engine.render('page', {layout: 'simple'})).to.equal('a layout the page bottom');
    expect(engine.render('content', {layout: 'base_layout'})).to.equal('header content footer');
  });

  it('extends layouts and renders the content with put', function() {
    const engine = beard({
      templates: {
        '/view': `{{extends 'layout'}}page content`,
        '/layout': `header {{put content}} footer`
      }
    });
    expect(engine.render('view')).to.equal(`header page content footer`);
  });

  it('handles for loops', function() {
    const engine = beard({ templates: {
      '/with-index': 'names = {{for name, index in names}} {{name}} - {{index}}{{end}}',
      '/no-index': 'names = {{for name in names}} {{name}}{{end}}'
    }});
    expect(engine.render('with-index', {names: ['Bill', 'John', 'Dave']})).
      to.equal('names =  Bill - 0 John - 1 Dave - 2');
    expect(engine.render('no-index', {names: ['Bill', 'John', 'Dave']})).
      to.equal('names =  Bill John Dave');
  });

  it('handles for loops with embedded values', function() {
      const engine = beard({ templates: {
        '/loops': `
        {{for name, index in ['Charles', 'John', 'Martin']}}
          {{index}} - {{name}}
        {{end}}

        {{for sort in [{label: 'Up', val: 'asc'}, {label: 'Down', val: 'desc'}]}}
          {{sort.label}} - {{sort.val}}
        {{end}}
        `
      }});
      expect(engine.render('/loops').trim()).to.equal('0 - Charles  1 - John  2 - Martin   Up - asc  Down - desc');
  });

  it('handles each loops', function() {
    const engine = beard({
      templates: {
        '/with-index': 'people = {{each person, index in people}}{{index}} - {{person.name.first}} {{person.name.last}}! {{end}}',
        '/no-index': 'people = {{each person in people}}{{person.name.first}} {{person.name.last}}! {{end}}'
      }
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
    expect(engine.render('with-index', {people: people})).
      to.equal('people = 0 - Charles Spurgeon! 1 - John Calvin! ');
    expect(engine.render('no-index', {people: people})).
      to.equal('people = Charles Spurgeon! John Calvin! ');
  });

  it('handles each loops with embedded values', function() {
    const engine = beard({
      templates: {
        '/loops': `
        {{each sort in [{label: 'Up', val: 'asc'}, {label: 'Down', val: 'desc'}]}}
          {{sort.label}} - {{sort.val}}
        {{end}}

        {{each count in ['Uno','Dos','Tres']}}
          {{count}}
        {{end}}
        `
      }
    });
    expect(engine.render('/loops').trim()).to.equal('Up - asc  Down - desc   Uno  Dos  Tres');
  });

  it('handles conditionals', function() {
    const engine = beard({
      templates: {
        '/with': `
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
        '/layout': `
          header
          {{nav}}
          -
          {{put content}}
          footer
        `
      }
    });
    expect(engine.render('with', {navigation: 'full'})).to.include('full navigation');
    expect(engine.render('with', {navigation: 'sub'})).to.include('subnavigation');
    expect(engine.render('with', {navigation: 'none'})).to.include('no nav');
  });

  it('handles strings', function() {
    const engine = beard({
      templates: {
        '/content': '{{content}}'
      }
    });
    expect(engine.render('content', {content: 'some content'})).to.equal('some content');
  });

  it('handles numbers', function() {
    const engine = beard({
      templates: {
        '/value': '{{value}}'
      }
    });
    expect(engine.render('value', {value: 36})).to.equal('36');
  });

  it('handles arrays', function() {
    const engine = beard({
      templates: {
        '/arrays': '{{each name in names}}{{name}} {{end}}'
      }
    });
    expect(engine.render('arrays', {names: ['John Calvin', 'Charles Spurgeon']})).to.equal('John Calvin Charles Spurgeon ');
  });

  it('handles arrays of objects', function() {
    const engine = beard({
      templates: {
        '/arrays': '{{each person in people}}{{person.name}} {{end}}'
      }
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
      templates: {
        '/functions': 'add = {{math.add(3, 10)}}, subtract = {{math.subtract(10, 5)}}'
      }
    });
    expect(engine.render('functions', {math: {add: (x, y) => x + y, subtract: (x, y) => x - y }}))
      .to.equal('add = 13, subtract = 5');
  });

  it('handles objects', function() {
    const engine = beard({
      templates: {
        '/object': '{{resource.slug}}'
      }
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
      templates: {
        '/null_value': '{{value}}'
      }
    });
    expect(engine.render('null_value', {value: null})).to.equal('null');
  });

  it('handles undefined values', function() {
    const engine = beard({
      templates: {
        '/undefined_value': '{{value}}'
      }
    });
    expect(engine.render('undefined_value', {value: undefined})).to.equal('undefined');
  });

  it('handles sublayouts', function() {
    const engine = beard({
      templates: {
        '/layout': 'header | {{content}} | footer',
        '/sublayout': "{{extends 'layout'}}{{sidebar}} | {{content}} | {{main}}",
        '/view': "{{include 'partial'}}",
        '/partial': "{{extends 'sublayout'}}{{block main}}main{{endblock}}{{block sidebar}}sidebar{{endblock}}hi im view"
      }
    });
    expect(engine.render('view')).to.equal('header | sidebar | hi im view | main | footer');
  });

  it('handles passing data to includes', function() {
    const engine = beard({
      templates: {
        '/view': `{{include 'item', {title: '1st', item: 1}}}, {{include 'item', {title: '2nd', item: 2}}}`,
        '/item': '{{title}} | {{item}}',
        '/multiline': `{{include 'item', {
          title: 'multi',
          item: 'line'
        }}}`
      }
    });
    expect(engine.render('view')).to.equal('1st | 1, 2nd | 2');
    expect(engine.render('multiline')).to.equal('multi | line');
  });

  it('handles includes with content blocks', function() {
    const engine = beard({
      templates: {
        '/templates/view': `
          start
          {{include '../header', content}}
            <h1>hello world</h1>
          {{endinclude}}
          end`,
        '/header': '{{content}} include'
      }
    });
    expect(engine.render('/templates/view').replace(/\s+/g, ' ')).to.equal(' start <h1>hello world</h1> include end');
  });

  it('handles includes with content blocks and data', function() {
    const engine = beard({
      templates: {
        '/templates/view': `
          start
          {{include '../header', {title: 'The Title'}, content}}
            <h1>Hello World</h1>
          {{endinclude}}
          end`,
        '/header': '{{content}} {{title}} include'
      }
    });
    expect(engine.render('/templates/view').replace(/\s+/g, ' ')).to.equal(' start <h1>Hello World</h1> The Title include end');
  });

  it('handles includes with content blocks and data and subincludes', function() {
    const engine = beard({
      templates: {
        '/templates/view': `
          start
          {{include '../header', {
            header: 'Header'
          }, content}}
            <h1>Header</h1>
          {{endinclude}}
          end`,
        '/header': `{{content}} {{include 'partial', {content: header}}} include`,
        '/partial': 'partial {{content}}'
      }
    });
    expect(engine.render('/templates/view').replace(/\s+/g, ' ')).to.equal(' start <h1>Header</h1> partial Header include end');
  });

  it('handles includes with content blocks inside an extends', function() {
    const engine = beard({
      templates: {
        '/templates/view': `
          {{extends '/layout'}}
          begin
          {{block nav}}
          main nav
          {{endblock}}
          {{include '../header', content}}
            <h1>Header</h1>
          {{endinclude}}
          end`,
        '/header': `{{content}} include`,
        '/layout': `
          top
          {{nav}}
          -
          {{content}}
          footer
        `
      }
    });
    expect(engine.render('/templates/view').replace(/\s+/g, ' ')).
      to.equal(' top main nav - begin <h1>Header</h1> include end footer ');
  });

  it('ignores inline css and js', function() {
    const engine = beard({
      templates: {
      '/template': `
        <style>
        .hello {
          background-color: #f33
        }
        </style>
        <div class="hello">greetings</div>
        <script>
        function inlineScript() {
          var obj = {
            name: 'Jack Black'
          };

          console.log(obj);
        }
        </script>
      `
      }
    });
    expect(engine.render('template')).to.equal(`
        <style>
        .hello {
          background-color: #f33
        }
        </style>
        <div class="hello">greetings</div>
        <script>
        function inlineScript() {
          var obj = {
            name: 'Jack Black'
          };

          console.log(obj);
        }
        </script>
      `.replace(/\s+/g, ' '));
  });

  it('handles nested template data', function() {
    const engine = beard({
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
    });
    expect(engine.render('view', {names: ['Jack', 'Black', 'John'], value: 'b'}).replace(/\s+/g, ' ')).to
      .equal(' im inside layout Jack Black John second partialblock im in sublayout im the view im in foo block ');
  });

  it('encodes html', function() {
    const engine = beard({
      templates: {
        '/encode': '{{:value}}'
      }
    });
    expect(engine.render('encode', {value: 'result&amp;script<script>alert("hi\'");</script>'}))
      .to.equal('result&amp;script&#60;script&#62;alert(&#34;hi&#39;&#34;);&#60;&#47;script&#62;');
  });

  it('checks if undefined var exists', function() {
    const engine = beard({
      templates: {
        '/content': `{{exists jack}}jack does exist{{else}}jack does not exist{{end}}`,
      }
    });
    expect(engine.render('content')).to.equal('jack does not exist');
  });

  it('checks if assigned var exists', function() {
    const engine = beard({
      templates: {
        '/content': `{{block jack}}im jack{{endblock}}{{exists jack}}jack block exists{{else}}jack does not exist{{end}}`,
      }
    });
    expect(engine.render('content')).to.equal('jack block exists');
  });

  it('puts assigned var', function() {
    const engine = beard({
      templates: {
        '/content': `{{block jack}}im jack{{endblock}}{{put jack}}`,
      }
    });
    expect(engine.render('content')).to.equal('im jack');
  });

  it('puts undefined var without throwing error', function() {
    const engine = beard({
      templates: {
        '/content': `{{put jack}}`,
      }
    });
    expect(engine.render('content')).to.equal('');
  });

  it('does not render comments', function() {
    const engine = beard({
      templates: {
        '/comments': 'some {{* a comment *}}content{{*another one*}}'
      }
    });
    expect(engine.render('comments')).to.equal('some content');
  });
});

describe('File Traversing', function() {
  it('renders files from the file system', function() {
    const engine = beard({
      root: __dirname
    });
    expect(engine.render('view').replace(/\s+/g, ' ')).to.equal('header | the view click | footer');
  });
});

describe('Custom Tags', function() {
  it('allows custom tags to be set', function() {
    const engine = beard({
      templates: {
        '/views/content': `{{asset '../images/calvin.png'}}`,
      },
      customTags: {
        asset: (path) => `/dist${path}`
      }
    });
    expect(engine.render('/views/content')).to.equal('/dist/images/calvin.png');
  });

  it('allows custom tags with data', function() {
    const engine = beard({
      templates: {
        '/view': `{{asset '/calvin.png'}} page {{component 'simple', {title: 'Foo'}}}`,
        '/components/simple': '{{title}} component'
      },
      customTags: {
        asset: (path) => `/dist${path}`,
        component: (path, data) => engine.render('/components' + path, data)
      }
    });
    expect(engine.render('view')).to.equal('/dist/calvin.png page Foo component');
  });

  it('allows custom tags with dynamic paths', function() {
    const engine = beard({
      templates: {
        '/view': "{{asset assetName}} page {{component `/components/${componentName}`, {title: 'Foo'}}} {{component other.replace('_', '-'), {name: 'Foo Bar'}}}",
        '/components/simple': '{{title}} component',
        '/foo-bar': 'The {{name}}'
      },
      customTags: {
        asset: (path) => path,
        component: (path, data) => engine.render(path, data)
      }
    });
    expect(engine.render('view', {assetName: 'calvin.png', componentName: 'simple', other: 'foo_bar'}))
      .to.equal('/calvin.png page Foo component The Foo Bar');
  });

  it('handles custom tags with block content', function() {
    const engine = beard({
      templates: {
        '/templates/view': `
          top
          {{component '../header', content}}
            <h1>hello world</h1>
          {{endcomponent}}`,
        '/header': '{{content}} component'
      },
      customContentTags: {
        component: (path, data) => engine.render(path, data)
      }
    });
    expect(engine.render('/templates/view').replace(/\s+/g, ' ')).to.equal(' top <h1>hello world</h1> component');
  });

  it('handles custom tags with block content and data', function() {
    const engine = beard({
      templates: {
        '/templates/view': `
          top
          {{component '../header', {title: 'the title'}, content}}
            <h1>hello world</h1>
          {{endcomponent}}`,
        '/header': '{{content}} {{title}} component'
      },
      customContentTags: {
        component: (path, data) => engine.render(path, data)
      }
    });
    expect(engine.render('/templates/view').replace(/\s+/g, ' ')).
      to.equal(' top <h1>hello world</h1> the title component');
  });

  it('handles custom tags with block content, data and subcomponents', function() {
    const engine = beard({
      templates: {
        '/templates/view': `
          top
          {{component '../header',
            {
              title: 'the title'
            }, content}}
            <h1>hello world</h1>
            {{component '/sub'}}
          {{endcomponent}}`,
        '/header': '{{content}} {{title}} component',
        '/sub': 'the sub!'
      },
      customContentTags: {
        component: (path, data) => engine.render(path, data)
      }
    });
    expect(engine.render('/templates/view').replace(/\s+/g, ' ')).
      to.equal(' top <h1>hello world</h1> the sub! the title component');
  });

  it('handles custom tags with block content and extended layouts', function() {
    const engine = beard({
      templates: {
        '/templates/view': `
          {{extends '../layout'}}
          top
          {{block nav}}the nav{{endblock}}
          {{component '../header', content}}
            <h1>hello world</h1>
          {{endcomponent}}`,
        '/header': '{{content}} component',
        '/layout': 'begin {{nav}} {{content}} end'
      },
      customContentTags: {
        component: (path, data) => engine.render(path, data)
      }
    });
    expect(engine.render('/templates/view').replace(/\s+/g, ' ')).
      to.equal('begin the nav top <h1>hello world</h1> component end');
  });
});

describe('Bundling', function() {
  let engine;

  before(() => engine = beard({ root: `${__dirname}/bundle` }));

  it('bundles inline css', function() {
    engine.render('simple');
    const bundledCSS = fs.readFileSync(`${__dirname}/.beard/simple.ed10418f.scss`, 'utf8').trim();
    expect(bundledCSS.replace(/\s+/g, ' ')).to.equal(`body { color: blue; }`);
  });
});