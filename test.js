const { expect } = require('chai');

const beard = require('./beard');
const beardInstance = beard({
  'content': 'some content',
  'layout': 'header {{nav}} - {{view}} footer'
});

describe('Beard Rendering', function() {
  it('renders content', function() {
    expect(beardInstance.render('some content')).to.
      equal('some content');
  });

  it('includes templates', function() {
    expect(beardInstance.render('header {{include content}} footer')).to.
      equal('header some content footer');
  });

  it('renders blocks', function() {
    expect(beardInstance.render('{{block footer}}a footer{{endblock}}some info - {{footer}}')).to.
      equal('some info - a footer');
  });

  it('extends layouts', function() {
    expect(beardInstance.render('{{extend layout}}page content{{block nav}}main navigation{{endblock}}')).to.
      equal('header main navigation - page content footer');
  });

  it('handles for loops', function() {
    expect(beardInstance.render('names = {{for name in names}} {{name}}{{end}}', {names: ['Bill', 'John', 'Dave']})).to.
      equal('names =  Bill John Dave');
  });

  it('handles each loops', function() {
    const people = {
      spurgeon: {
        name: {
          first: 'Charles',
          last: 'Spurgeon'
        }
      },
      calvin: {
        name: {
          first: 'John',
          last: 'Calvin'
        }
      }
    }
    const withForLoop = 'people = {{for key, idx in people}}{{key}}: {{idx.name.first}} {{idx.name.last}}! {{end}}';
    expect(beardInstance.render(withForLoop, {people: people})).to.
      equal('people = spurgeon: Charles Spurgeon! calvin: John Calvin! ');
  });

  it('handles conditionals', function() {
    const withConditional = `
      {{extend layout}}
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
});
