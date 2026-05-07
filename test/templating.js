const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const beard = require('../lib/index');


describe('Templating', function() {
  it('renders content', function() {
    const engine = beard({
      templates: {
        '/content': 'some content'
      }
    });
    assert.equal(engine.render('content'), 'some content');
  });

  it('handles errors', function() {
    const engine = beard({
      templates: {
        '/content': '{{foo}}}'
      }
    });
    assert.throws(
      () => engine.render('content', {foo: 'value'}),
      (err) => /"\{\{foo\}\}\}" in \/content on line 1/.test(err.message)
    );
  });

  it('includes templates', function() {
    const engine = beard({
      templates: {
        '/content': 'some content',
        '/view': `header {{include 'content'}} footer`
      }
    });
    assert.equal(engine.render('view'), 'header some content footer');
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
    assert.equal(
      engine.render('view', {partial: '/includes/content', support: 'footer', other: 'other_content'}),
      'header Partial Content Footer Content!'
    );
  });

  it('renders blocks', function() {
    const engine = beard({
      templates: {
        '/block': '{{block footer}}a footer{{endblock}}some info - {{footer}}'
      }
    });
    assert.equal(engine.render('block'), 'some info - a footer');
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
    assert.equal(engine.render('block').replace(/\s+/g, ' '), ' a footer -- bill -- subinfo ');
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
    assert.equal(engine.render('view').replace(/\s+/g, ' '), ` header main navigation - page content footer `);
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
    assert.equal(engine.render('view', {layout: 'base'}), 'header page footer');
    assert.equal(engine.render('page', {layout: 'simple'}), 'a layout the page bottom');
    assert.equal(engine.render('content', {layout: 'base_layout'}), 'header content footer');
  });

  it('extends layouts and renders the content with put', function() {
    const engine = beard({
      templates: {
        '/view': `{{extends 'layout'}}page content`,
        '/layout': `header {{put content}} footer`
      }
    });
    assert.equal(engine.render('view'), `header page content footer`);
  });

  it('handles for loops', function() {
    const engine = beard({ templates: {
      '/with-index': 'names = {{for name, index in names}} {{name}} - {{index}}{{end}}',
      '/no-index': 'names = {{for name in names}} {{name}}{{end}}'
    }});
    assert.equal(engine.render('with-index', {names: ['Bill', 'John', 'Dave']}), 'names =  Bill - 0 John - 1 Dave - 2');
    assert.equal(engine.render('no-index', {names: ['Bill', 'John', 'Dave']}), 'names =  Bill John Dave');
  });

  it('handles multiline for blocks with functions', function() {
    const engine = beard({ templates: {
      '/view': `
      {{for name in ['charles', 'john', 'martin'].map((n) => {
        return n.toUpperCase();
        })}}
        {{name}}
      {{end}}
      `
    }});
    assert.equal(engine.render('view').replace(/\s+/gm, ' ').trim(), 'CHARLES JOHN MARTIN');
  });

  it('handles each loops', function() {
    const engine = beard({
      templates: {
        '/with-index': 'people = {{each person, index in people}}{{index}} - {{person.name.first}} {{person.name.last}}! {{end}}',
        '/no-index': 'people = {{each person in people}}{{person.name.first}} {{person.name.last}}! {{end}}'
      }
    });
    const people = [
      { name: { first: 'Charles', last: 'Spurgeon' } },
      { name: { first: 'John', last: 'Calvin' } }
    ];
    assert.equal(engine.render('with-index', {people}), 'people = 0 - Charles Spurgeon! 1 - John Calvin! ');
    assert.equal(engine.render('no-index', {people}), 'people = Charles Spurgeon! John Calvin! ');
  });

  it('handles each loops with maps', function() {
    const engine = beard({
      templates: {
        '/view': `
        {{each person in people.map((n) => {
          return n.toUpperCase();
          })}}
          {{person}}
        {{end}}
        `
      }
    });
    const people = ['charles', 'john'];
    assert.equal(engine.render('view', {people}).replace(/\s+/gm, ' ').trim(), 'CHARLES JOHN');
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
    assert.equal(engine.render('/loops').replace(/\s+/gm, ' ').trim(), 'Up - asc Down - desc Uno Dos Tres');
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
    assert.ok(engine.render('with', {navigation: 'full'}).includes('full navigation'));
    assert.ok(engine.render('with', {navigation: 'sub'}).includes('subnavigation'));
    assert.ok(engine.render('with', {navigation: 'none'}).includes('no nav'));
  });

  it('handles conditionals with functions', function() {
    const engine = beard({
      templates: {
        '/view': `
          {{if ['FULL', 'PARTIAL'].map((s) => {
            return s.toLowerCase();
          }).includes(navigation)}}
            full navigation
          {{else if ['OPTION'].map((s) => {
            return s.toLowerCase();
          }).includes(navigation)}}
            option navigation
          {{end}}
        `
      }
    });
    assert.ok(engine.render('view', {navigation: 'full'}).includes('full navigation'));
    assert.ok(engine.render('view', {navigation: 'option'}).includes('option navigation'));
    assert.equal(engine.render('view', {navigation: 'none'}).trim(), '');
  });

  it('handles strings', function() {
    const engine = beard({
      templates: { '/content': '{{content}}' }
    });
    assert.equal(engine.render('content', {content: 'some content'}), 'some content');
  });

  it('handles numbers', function() {
    const engine = beard({
      templates: { '/value': '{{value}}' }
    });
    assert.equal(engine.render('value', {value: 36}), '36');
  });

  it('handles arrays', function() {
    const engine = beard({
      templates: { '/arrays': '{{each name in names}}{{name}} {{end}}' }
    });
    assert.equal(engine.render('arrays', {names: ['John Calvin', 'Charles Spurgeon']}), 'John Calvin Charles Spurgeon ');
  });

  it('handles arrays of objects', function() {
    const engine = beard({
      templates: { '/arrays': '{{each person in people}}{{person.name}} {{end}}' }
    });
    const data = {
      people: [
        { name: 'John Knox' },
        { name: 'Charles Spurgeon' },
        { name: 'John Owen' }
      ]
    };
    assert.equal(engine.render('arrays', data), 'John Knox Charles Spurgeon John Owen ');
  });

  it('handles functions', function() {
    const engine = beard({
      templates: { '/functions': 'add = {{math.add(3, 10)}}, subtract = {{math.subtract(10, 5)}}' }
    });
    assert.equal(
      engine.render('functions', {math: {add: (x, y) => x + y, subtract: (x, y) => x - y}}),
      'add = 13, subtract = 5'
    );
  });

  it('handles objects', function() {
    const engine = beard({
      templates: { '/object': '{{resource.slug}}' }
    });
    const data = { resource: { slug: 'the-most-interesting-article' } };
    assert.ok(engine.render('object', data).includes('the-most-interesting-article'));
  });

  it('handles null values', function() {
    const engine = beard({
      templates: { '/null_value': '{{value}}' }
    });
    assert.equal(engine.render('null_value', {value: null}), 'null');
  });

  it('handles undefined values', function() {
    const engine = beard({
      templates: { '/undefined_value': '{{value}}' }
    });
    assert.equal(engine.render('undefined_value', {value: undefined}), 'undefined');
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
    assert.equal(engine.render('view'), 'header | sidebar | hi im view | main | footer');
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
    assert.equal(engine.render('view'), '1st | 1, 2nd | 2');
    assert.equal(engine.render('multiline'), 'multi | line');
  });

  it('handles includes with content blocks', function() {
    const engine = beard({
      templates: {
        '/templates/view': `
          start
          {{include:content '../header'}}
            <h1>hello world</h1>
          {{endinclude}}
          end`,
        '/header': '{{content}} include'
      }
    });
    assert.equal(engine.render('/templates/view').replace(/\s+/g, ' '), ' start <h1>hello world</h1> include end');
  });

  it('handles includes with content blocks and data', function() {
    const engine = beard({
      templates: {
        '/templates/view': `
          start
          {{include:content '../header', {title: 'The Title'}}}
            <h1>Hello World</h1>
          {{endinclude}}
          end`,
        '/header': '{{content}} {{title}} include'
      }
    });
    assert.equal(engine.render('/templates/view').replace(/\s+/g, ' '), ' start <h1>Hello World</h1> The Title include end');
  });

  it('handles includes with content blocks and data and subincludes', function() {
    const engine = beard({
      templates: {
        '/templates/view': `
          start
          {{include:content '../header', {
            header: 'Header'
          }}}
            <h1>Header</h1>
          {{endinclude}}
          end`,
        '/header': `{{content}} {{include 'partial', {content: header}}} include`,
        '/partial': 'partial {{content}}'
      }
    });
    assert.equal(engine.render('/templates/view').replace(/\s+/g, ' '), ' start <h1>Header</h1> partial Header include end');
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
          {{include:content '../header'}}
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
    assert.equal(engine.render('/templates/view').replace(/\s+/g, ' '), ' top main nav - begin <h1>Header</h1> include end footer ');
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
    assert.equal(engine.render('template'), `
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
      `);
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
    assert.equal(
      engine.render('view', {names: ['Jack', 'Black', 'John'], value: 'b'}).replace(/\s+/g, ' '),
      ' im inside layout Jack Black John second partialblock im in sublayout im the view im in foo block '
    );
  });

  it('encodes html', function() {
    const engine = beard({
      templates: { '/encode': '{{:value}}' }
    });
    assert.equal(
      engine.render('encode', {value: 'result&amp;script<script>alert("hi\'");</script>'}),
      'result&amp;script&#60;script&#62;alert(&#34;hi&#39;&#34;);&#60;&#47;script&#62;'
    );
  });

  it('checks if undefined var exists', function() {
    const engine = beard({
      templates: { '/content': `{{exists jack}}jack does exist{{else}}jack does not exist{{end}}` }
    });
    assert.equal(engine.render('content'), 'jack does not exist');
  });

  it('checks if var does not exist', function() {
    const engine = beard({
      templates: { '/content': `{{existsNot jack}}jack does not exist{{else}}jack does exist{{end}}` }
    });
    assert.equal(engine.render('content'), 'jack does not exist');
  });

  it('checks if assigned var exists', function() {
    const engine = beard({
      templates: { '/content': `{{block jack}}im jack{{endblock}}{{exists jack}}jack block exists{{else}}jack does not exist{{end}}` }
    });
    assert.equal(engine.render('content'), 'jack block exists');
  });

  it('puts assigned var', function() {
    const engine = beard({
      templates: { '/content': `{{block jack}}im jack{{endblock}}{{put jack}}` }
    });
    assert.equal(engine.render('content'), 'im jack');
  });

  it('puts undefined var without throwing error', function() {
    const engine = beard({
      templates: { '/content': `{{put jack}}` }
    });
    assert.equal(engine.render('content'), '');
  });

  it('does not render comments', function() {
    const engine = beard({
      templates: { '/comments': 'some {{* a comment *}}content{{*another one*}}' }
    });
    assert.equal(engine.render('comments'), 'some content');
  });

  describe('tag helper', function() {
    it('renders a singleton tag', function() {
      const engine = beard({
        templates: { '/content': `{{tag 'br'}}` }
      });
      assert.equal(engine.render('content'), '<br>');
    });

    it('renders a tag with attributes', function() {
      const engine = beard({
        templates: { '/content': `{{tag 'input', {type: 'text'}}}` }
      });
      assert.equal(engine.render('content'), '<input type="text">');
    });

    it('renders true attributes without a value', function() {
      const engine = beard({
        templates: { '/content': `{{tag 'input', {type: 'checkbox', checked: true}}}` }
      });
      assert.equal(engine.render('content'), '<input type="checkbox" checked>');
    });

    it('does not render false or null values', function() {
      const engine = beard({
        templates: { '/content': `{{tag 'input', {type: 'checkbox', checked: false, selected: null}}}` }
      });
      assert.equal(engine.render('content'), '<input type="checkbox">');
    });

    it('renders tags with value attributes', function() {
      const engine = beard({
        templates: { '/content': `{{tag 'input', {type: 'text', value: 'john'}}}` }
      });
      assert.equal(engine.render('content'), '<input type="text" value="john">');
    });

    it('renders non-singleton tags with a closing tag', function() {
      const engine = beard({
        templates: { '/content': `{{tag 'textarea'}}` }
      });
      assert.equal(engine.render('content'), '<textarea></textarea>');
    });

    it('renders non-singleton tags with text content', function() {
      const engine = beard({
        templates: { '/content': `{{tag 'textarea', {content: 'content'}}}` }
      });
      assert.equal(engine.render('content'), '<textarea>content</textarea>');
    });

    it('renders tags with text value', function() {
      const engine = beard({
        templates: { '/content': `{{tag 'textarea', {value: 'value'}}}` }
      });
      assert.equal(engine.render('content'), '<textarea>value</textarea>');
    });

    it('renders content captures as the text value', function() {
      const engine = beard({
        templates: { '/content': `{{tag:content 'textarea'}}some content{{endtag}}` }
      });
      assert.equal(engine.render('content'), '<textarea>some content</textarea>');
    });
  });
});
