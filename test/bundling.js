const beard = require('../lib/index');
const fs = require('fs');
const chai = require('chai');
const expect = chai.expect;
chai.use(require('chai-string'));

const read = (file) => fs.readFileSync(`${__dirname}/../.beard/${file}`, 'utf8').trim();
const contents = (path, ext) => {
  const files = fs.readdirSync(`${__dirname}/../.beard`);
  const file = files.find(file => new RegExp(`${path}\.[^\.]+\.${ext}`).test(file));
  return fs.readFileSync(`${__dirname}/../.beard/${file}`, 'utf8').trim().replace(/\s+/g, ' ');
}

const engine = beard({ root: __dirname });

describe('Bundling', function() {
  it('extracts style blocks into scss asset files and imports them in the entry file', function() {
    expect(engine.render('templates/simple')).to.not.include('body { color: blue; }');
    expect(contents('simple', 'scss')).to.equalIgnoreSpaces('body { color: blue; }');
    expect(read('entry.css')).to.include("@import './simple.ed10418f.scss';");
  });

  it('extracts frontend script blocks into js asset files and imports them in the entry file', function() {
    expect(engine.render('templates/simple')).to.not.include("document.getElementById('demo').innerHTML = 'hello';");
    expect(contents('simple', 'js')).to.equalIgnoreSpaces("document.getElementById('demo').innerHTML = 'hello';");
    expect(read('entry.js')).to.include("import './simple.6b756e34.js';");
  });

  it('extracts the ssjs script block', function() {
    expect(contents('simple', 'ssjs.js')).to.equalIgnoreSpaces("const foo = 'boo';");
  });

  describe('when script or style block has bundle attribute', function() {
    it('creates a custom bundle entry file', function() {
      expect(read('alert.css')).to.equalIgnoreSpaces("@import './named-bundle.e6035d8f.scss';");
      expect(read('alert.js')).to.equalIgnoreSpaces("import './named-bundle.03e83341.js';");
    });
  });

  describe('when style block has lang attribute', function() {
    it('sets file extension on extracted block file', function() {
      expect(contents('lang', 'less')).to.equalIgnoreSpaces(`@color: blue; body { color: @color; }`);
    });
  });

  describe('when style block is scoped', function() {
    it('sets custom css class names on css styles and on html elements', function() {
      expect(engine.render('templates/scoped')).to.equalIgnoreSpaces('<body><span class="b-bd1f4a0b">test</span></body>');
      expect(contents('scoped', 'scss')).to.equalIgnoreSpaces('span.b-bd1f4a0b { color: green; }');
    });

    it('does not set custom css class names on nested css styles', function() {
      expect(engine.render('templates/scoped-nested')).to.equalIgnoreSpaces('<body> <span class="b-b10420e7">test</span> <h1 class="b-e210a428">These tacos are <em>amazin</em>!</h1> </body>');
      expect(contents('scoped-nested', 'scss')).to.equalIgnoreSpaces('span.b-b10420e7 { color: green; } h1.b-e210a428 { color: blue; em { font-style: italic; } }');
    });

    it('sets custom css class names on nested styles in media elements', function() {
      expect(engine.render('templates/scoped-media-queries')).to.equalIgnoreSpaces('<body class="b-5916699f"> <span class="b-7f731c23">test</span> </body>');
      expect(contents('scoped-media-queries', 'scss')).to.equalIgnoreSpaces('@media screen {body.b-5916699f { color: green; } span.b-7f731c23 { color: green; }}');
    });

    it('sets custom css class names before deep selector', function() {
      expect(engine.render('templates/scoped-deep')).to.equalIgnoreSpaces('<h1><em class="b-5343f3be">hello</em></h1>');
      expect(contents('scoped-deep', 'scss')).to.equalIgnoreSpaces('h1.b-5343f3be em { color: red; }');
    });

    it('sets custom css class names on chained selectors', function() {
      expect(engine.render('templates/scoped-chaining')).to.equalIgnoreSpaces('<h1><em class="b-c60ed2bf">hello h1</em></h1> <h4><em class="b-c60ed2bf">hello h4</em></h4> <div><em class="b-c60ed2bf">hello div</em></div>');
      expect(contents('scoped-chaining', 'scss')).to.equalIgnoreSpaces('h1.b-c60ed2bf em.b-c60ed2bf, h4.b-c60ed2bf em.b-c60ed2bf:first-of-type, div.b-c60ed2bf em.b-c60ed2bf { color: green; }');
    });
  });
});
