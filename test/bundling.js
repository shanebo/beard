const beard = require('../lib/index');
const fs = require('fs');
const { expect } = require('chai');
const read = (file) => fs.readFileSync(`${__dirname}/../.beard/${file}`, 'utf8').trim();
const contents = (path, ext) => {
  const files = fs.readdirSync(`${__dirname}/../.beard`);
  const file = files.find(file => new RegExp(`${path}\.[^\.]+\.${ext}`).test(file));
  const content = fs.readFileSync(`${__dirname}/../.beard/${file}`, 'utf8');
  return content.trim().replace(/\s+/g, ' ');
}

const engine = beard({ root: __dirname });

describe('Bundling', function() {
  it('extracts style blocks into scss asset files and imports them in the entry file', function() {
    expect(engine.render('templates/simple')).to.not.include('body { color: blue; }');
    expect(contents('simple', 'scss')).to.equal('body { color: blue; }');
    expect(read('entry.css')).to.include("@import './simple.ed10418f.scss';");
  });

  it('extracts frontend script blocks into js asset files and imports them in the entry file', function() {
    expect(engine.render('templates/simple')).to.not.include("document.getElementById('demo').innerHTML = 'hello';");
    expect(contents('simple', 'js')).to.equal("document.getElementById('demo').innerHTML = 'hello';");
    expect(read('entry.js')).to.include("import './simple.6b756e34.js';");
  });

  it('extracts the ssjs script block', function() {
    expect(contents('simple', 'ssjs.js')).to.equal("const foo = 'boo';");
  });

  describe('when script or style block has bundle attribute', function() {
    it('creates a custom bundle entry file', function() {
      expect(read('alert.css')).to.equal("@import './named-bundle.e6035d8f.scss';");
      expect(read('alert.js')).to.equal("import './named-bundle.03e83341.js';");
    });
  });

  describe('when style block has lang attribute', function() {
    it('sets file extension on extracted block file', function() {
      expect(contents('lang', 'less')).to.equal(`@color: blue; body { color: @color; }`);
    });
  });

  describe('when style block is scoped', function() {
    it('sets custom css class names on css styles and on html elements', function() {
      expect(engine.render('templates/scoped')).to.equal('<body><span class="b-197fc3bd">test</span></body>');
      expect(contents('scoped', 'scss')).to.equal('span.b-197fc3bd { color: green; }');
    });

    it('does not set custom css class names on nested css styles', function() {
      expect(engine.render('templates/scoped-nested')).to.equal('<body> <span class="b-c24da3d2">test</span> <h1 class="b-56a1a291">These tacos are <em>amazin</em>!</h1> </body>');
      expect(contents('scoped-nested', 'scss')).to.equal('span.b-c24da3d2 { color: green; } h1.b-56a1a291 { color: blue; em { font-style: italic; } }');
    });

    it('sets custom css class names on nested styles in media elements', function() {
      expect(engine.render('templates/scoped-media-queries')).to.equal('<body class="b-9f0496ca"> <span class="b-d2ce15b8">test</span> </body>');
      expect(contents('scoped-media-queries', 'scss')).to.equal('@media screen {body.b-9f0496ca { color: green; } span.b-d2ce15b8 { color: green; }}');
    });

    it('sets custom css class names before deep selector', function() {
      expect(engine.render('templates/scoped-deep')).to.equal('<h1><em class="b-9655ccf2">hello</em></h1>');
      expect(contents('scoped-deep', 'scss')).to.equal('h1.b-9655ccf2 em { color: red; }');
    });

    it('sets custom css class names on chained selectors', function() {
      expect(engine.render('templates/scoped-chaining')).to.equal('<h1><em class="b-8aa84ae0">hello h1</em></h1> <h4><em class="b-8aa84ae0">hello h4</em></h4> <div><em class="b-8aa84ae0">hello div</em></div>');
      expect(contents('scoped-chaining', 'scss')).to.equal('h1 em.b-8aa84ae0, h4 em.b-8aa84ae0:first-of-type, div em.b-8aa84ae0 { color: green; }');
    });
  });
});
