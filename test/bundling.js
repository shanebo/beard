const { expect } = require('chai');
const normalize = require('path').normalize;
const fs = require('fs');

const beard = require('../lib/index');

describe('Bundling', function() {
  let engine;

  before(() => engine = beard({ root: __dirname }));

  it('extracts style blocks into scss asset files and imports them in the entry file', function() {
    expect(engine.render('templates/simple').replace(/\s+/g, ' ')).to.not.include('body { color: blue; }');
    const bundledCSS = fs.readFileSync(`${__dirname}/../.beard/simple.ed10418f.scss`, 'utf8').trim();
    expect(bundledCSS.replace(/\s+/g, ' ')).to.equal('body { color: blue; }');
    const entryCSS = fs.readFileSync(`${__dirname}/../.beard/entry.css`, 'utf8').trim();
    expect(entryCSS).to.include("@import './simple.ed10418f.scss';");
  });

  it('extracts frontend script blocks into js asset files and imports them in the entry file', function() {
    expect(engine.render('templates/simple')).to.not.include("document.getElementById('demo').innerHTML = 'hello';");
    const bundledJS = fs.readFileSync(`${__dirname}/../.beard/simple.6b756e34.js`, 'utf8').trim();
    expect(bundledJS).to.equal("document.getElementById('demo').innerHTML = 'hello';");
    const entryCSS = fs.readFileSync(`${__dirname}/../.beard/entry.js`, 'utf8').trim();
    expect(entryCSS).to.include("import './simple.6b756e34.js';");
  });

  it('extracts the ssjs script block', function() {
    engine.render('templates/simple');
    const contents = fs.readFileSync(`${__dirname}/../.beard/simple.3deaf010.ssjs.js`, 'utf8').trim();
    expect(contents.trim().replace(/\s+/g, ' ')).to.equal("const foo = 'boo';");
  });

  describe('when script or style block has bundle attribute', function() {
    it('creates a custom bundle entry file', function() {
      engine.render('templates/named-bundle');
      const entryCSS = fs.readFileSync(`${__dirname}/../.beard/alert.css`, 'utf8').trim();
      expect(entryCSS).to.equal("@import './named-bundle.e6035d8f.scss';");
      const entryJS = fs.readFileSync(`${__dirname}/../.beard/alert.js`, 'utf8').trim();
      expect(entryJS).to.equal("import './named-bundle.03e83341.js';");
    });
  });

  describe('when style block has lang attribute', function() {
    it('sets file extension on extracted block file', function() {
      engine.render('templates/lang');
      const bundledCSS = fs.readFileSync(`${__dirname}/../.beard/lang.28d75d5c.less`, 'utf8').trim();
      expect(bundledCSS.replace(/\s+/g, ' ')).to.equal(`@color: blue; body { color: @color; }`);
    });
  });

  describe('when style block is scoped', function() {
    it('sets custom css class names on css styles and on html elements', function() {
      expect(engine.render('templates/scoped')).to.equal('<body><span class="beard-3955489847">test</span></body>');
      const contents = fs.readFileSync(`${__dirname}/../.beard/scoped.58f0173c.scss`, 'utf8').trim();
      expect(contents.trim().replace(/\s+/g, ' ')).to.equal('.beard-3955489847 { color: green; }');
    });

    it('does not set custom css class names on nested css styles', function() {
      expect(engine.render('templates/scoped-nested')).to
        .equal('<body> <span class="beard-2111845271">test</span> <h1 class="beard-1540222833">These tacos are <em>amazin</em>!</h1> </body>');
      const contents = fs.readFileSync(`${__dirname}/../.beard/scoped-nested.de8d39b0.scss`, 'utf8').trim();
      expect(contents.trim().replace(/\s+/g, ' ')).to
        .equal('.beard-2111845271 { color: green; } .beard-1540222833 { color: blue; em { font-style: italic; } }');
    });

    it('sets custom css class names on nested styles in media elements', function() {
      expect(engine.render('templates/scoped-media-elements')).to
        .equal('<body class="beard-2292564546"> <span class="beard-2168526814">test</span> </body>');
      const contents = fs.readFileSync(`${__dirname}/../.beard/scoped-media-elements.7f3f6d01.scss`, 'utf8').trim();
      expect(contents.trim().replace(/\s+/g, ' ')).to
        .equal('@media screen {.beard-2292564546 { color: green; } .beard-2168526814 { color: green; }}');
    });
  });
});
