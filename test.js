const { expect } = require('chai');

const beard = require('./beard');

describe('Beard Rendering', function() {
  const beardInstance = beard({
    'content': 'some content',
    'layout': 'header {{nav}} - {{view}} footer'
  });

  it('renders content', function() {
    expect(beardInstance.render('some content')).to.
      equal('some content');
  });

  it('includes templates', function() {
    expect(beardInstance.render(`header {{include 'content'}} footer`)).to.
      equal('header some content footer');
  });

  it('renders blocks', function() {
    expect(beardInstance.render('{{block footer}}a footer{{endblock}}some info - {{footer}}')).to.
      equal('some info - a footer');
  });

  it('extends layouts', function() {
    expect(beardInstance.render("{{extends 'layout'}}page content{{block nav}}main navigation{{endblock}}")).to.
      equal('header main navigation - page content footer');
  });

  it('handles for loops', function() {
    expect(beardInstance.render('names = {{for name in names}} {{name}}{{end}}', {names: ['Bill', 'John', 'Dave']})).to.
      equal('names =  Bill John Dave');
  });

  it('handles each loops', function() {
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
    const withEachLoop = 'people = {{each person in people}}{{person.name.first}} {{person.name.last}}! {{end}}';
    expect(beardInstance.render(withEachLoop, {people: people})).to.
      equal('people = Charles Spurgeon! John Calvin! ');
  });

  it('handles conditionals', function() {
    const withConditional = `
      {{extends 'layout'}}
      {{if navigation === 'full'}}
        {{block nav}}full navigation{{endblock}}
      {{else if navigation === 'sub'}}
        {{block nav}}subnavigation{{endblock}}
      {{else}}
        {{block nav}}no nav{{endblock}}
      {{end}}
      {{nav}}
    `;
    expect(beardInstance.render(withConditional, {navigation: 'full'})).to.
      include('full navigation');
    expect(beardInstance.render(withConditional, {navigation: 'sub'})).to.
      include('subnavigation');
    expect(beardInstance.render(withConditional, {navigation: 'none'})).to.
      include('no nav');
  });

  it('handles strings', function() {
    expect(beardInstance.render('{{content}}', {content: 'some content'})).to.equal('some content');
  });

  it('handles numbers', function() {
    expect(beardInstance.render('{{value}}', {value: 36})).to.equal('36');
  });

  it('handles arrays', function() {
    expect(beardInstance.render('{{each name in names}}{{name}} {{end}}', {names: ['John Calvin', 'Charles Spurgeon']})).
      to.equal('John Calvin Charles Spurgeon ');
  });

  it('handles arrays of objects', function() {
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
    expect(beardInstance.render('{{each person in people}}{{person.name}} {{end}}', data)).to.
      equal('John Knox Charles Spurgeon John Owen ');
  });

  it('handles functions', function() {
    expect(beardInstance.render('{{add(3, 10)}}', {add: (x, y) => x + y})).to.equal('13');
  });

  it('handles objects', function() {
    const data = {
      resource: {
        slug: 'the-most-interesting-article'
      }
    };
    expect(beardInstance.render('{{resource.slug}}', data)).to.include('the-most-interesting-article');
  });

  it('handles null values', function() {
    expect(beardInstance.render('{{value}}', {value: null})).to.equal('null');
  });

  it('handles undefined values', function() {
    expect(beardInstance.render('{{value}}', {value: undefined})).to.equal('undefined');
  });

  it('handles sublayouts', function() {
    const cache = {
      'layout': 'header | {{view}} | footer',
      'sublayout': "{{extends 'layout'}}{{sidebar}} | {{view}} | {{main}}",
      'view': "{{include 'partial'}}",
      'partial': "{{extends 'sublayout'}}{{block main}}main{{endblock}}{{block sidebar}}sidebar{{endblock}}hi im view"
    };
    const beard2 = beard(cache);
    expect(beard2.render(cache.view)).to.equal('header | sidebar | hi im view | main | footer');
  });

  it('handles passing data to includes', function() {
    const cache = {
      'item': '{{title}} | {{item}}'
    };
    const beard2 = beard(cache);
    expect(beard2.render(`{{include('item', {title: '1st', item: 1})}}, {{include('item', {title: '2nd', item: 2})}}`))
      .to.equal('1st | 1, 2nd | 2');
  });
});

describe('Beard Path Lookup', function() {
  const beardInstance = beard({
    '/views/content': 'view content',
    '/views/item': '{{title}} | {{item}}'
  }, (path) => `/views/${path}`);

  it('processes the path', function() {
    expect(beardInstance.render("{{include 'content'}}")).to.
      equal('view content');
  });

  it('handles passing data to includes', function() {
    expect(beardInstance.render(`{{include('item', {title: '1st', item: 1})}}, {{include('item', {title: '2nd', item: 2})}}`))
      .to.equal('1st | 1, 2nd | 2');
  });
});
