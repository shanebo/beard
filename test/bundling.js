const beard = require('../lib/index');
const fs = require('fs');
const chai = require('chai');
const { assert, expect } = chai;
chai.use(require('chai-string'));

const read = (file) => fs.readFileSync(`${__dirname}/../.beard/${file}`, 'utf8').trim();
const contents = (path, ext) => {
  const files = fs.readdirSync(`${__dirname}/../.beard`);
  const file = files.find(file => new RegExp(`${path}\.[^\.]+\.${ext}`).test(file));
  return fs.readFileSync(`${__dirname}/../.beard/${file}`, 'utf8').trim().replace(/\s+/g, ' ');
}

const engine = beard({ root: __dirname });

chai.use(function (chai, utils) {
  const Assertion = chai.Assertion;

  Assertion.addMethod('matchScoped', function (expected) {
    const hashRegex = new RegExp(expected.replace(/\$b/gm, '(b\-[0-9a-fA-F]{6})'));
    new Assertion(this._obj).to.match(hashRegex);
  });
});

// const hashRegex = (actual, expected) => {
//   const hashedExpected = expected.replace(/\$b/gm, '(b\-[0-9a-fA-F]{8})');
//   assert(new RegExp(hashedExpected).test(actual), `Expected ${actual} to be ${expected}`);
// }
// chai.Assertion.addChainableMethod('matchHashedHTML', hashRegex, chainingBehavior);
// expect(fooStr).to.be.foo('bar');
// expect(fooStr).to.be.foo.equal('foo');

describe('Bundling', function() {
  it('renders a simple bundled file', function() {
    expect(engine.render('templates/simple')).to.equal('<body> simple </body>');
  });

  it('extracts style blocks into scss asset files and imports them in the entry file', function() {
    expect(engine.render('templates/simple')).to.not.include('body { color: blue; }');
    expect(contents('simple', 'css')).to.equalIgnoreSpaces('body { color: blue; }');
    expect(read('entry.css')).to.include("@import './simple.");
  });

  it('extracts frontend script blocks into js asset files and imports them in the entry file', function() {
    expect(engine.render('templates/simple')).to.not.include("document.getElementById('demo').innerHTML = 'hello';");
    expect(contents('simple', 'js')).to.equalIgnoreSpaces("document.getElementById('demo').innerHTML = 'hello';");
    expect(read('entry.js')).to.include("import './simple.");
  });

  it('extracts the ssjs script block', function() {
    expect(contents('simple', 'ssjs.js')).to.equalIgnoreSpaces("const foo = 'boo';");
  });

  describe('when script or style block has bundle attribute', function() {
    it('creates a custom bundle entry file', function() {
      expect(read('alert.css')).to.includes("@import './named-bundle.");
      expect(read('alert.js')).to.includes("import './named-bundle.");
    });
  });

  describe('when script or style block has multiple bundle values in the bundle attribute', function() {
    it('creates a custom bundle entry file', function() {
      expect(read('alert.css')).to.includes("@import './multiple-bundles.");
      expect(read('info.css')).to.includes("@import './multiple-bundles.");
      expect(read('alert.js')).to.includes("import './multiple-bundles.");
      expect(read('main.js')).to.includes("import './multiple-bundles.");
    });
  });

  describe('when script block has inline attribute', function() {
    it('leaves the script tag in the template', function() {
      expect(engine.render('templates/inline-js')).to.
        equalIgnoreSpaces("<div>content</div> <script inline> alert('inline js'); </script>");
    });
  });

  describe('when style block is scoped', function() {
    it('sets custom css class names on css styles and on html elements', function() {
      expect(engine.render('templates/scoped')).to.matchScoped('<body><span class="$b">test</span></body>');
      expect(contents('scoped', 'css')).to.matchScoped('span.$b { color: green; }');
    });

    it('does not set custom css class names on nested css styles', function() {
      expect(engine.render('templates/scoped-nested')).to.matchScoped('<body> <span class="$b">test</span> <h1 class="$b">These tacos are <em>amazin</em>!</h1> </body>');
      expect(contents('scoped-nested', 'css')).to.matchScoped('span.$b { color: green; } h1.$b { color: blue; em { font-style: italic; } }');
    });

    it('handles regular media elements', function() {
      expect(contents('media-queries', 'css')).to.matchScoped('@page { color: green; font-size: 14px; }');
    });

    it('sets custom css class names on nested styles in media elements', function() {
      expect(engine.render('templates/scoped-media-queries')).to.matchScoped('<body class="$b"> <span class="$b">test</span> </body>');
      expect(contents('scoped-media-queries', 'css')).to.matchScoped('@media screen {body.$b { color: green; } span.$b { color: green; }}');
    });

    it('sets custom css class names before deep selector', function() {
      expect(engine.render('templates/scoped-deep')).to.matchScoped('<h1 class="$b"><em>hello</em></h1>');
      expect(contents('scoped-deep', 'css')).to.matchScoped('h1.$b em { color: red; }');
    });

    it('sets custom css class names on chained selectors', function() {
      expect(engine.render('templates/scoped-chaining')).to.matchScoped('<h1 class="$b"><em class="$b">hello h1</em></h1> <h4 class="$b"><em class="$b">hello h4</em></h4> <div class="$b"><em class="$b">hello div</em></div>');
      expect(contents('scoped-chaining', 'css')).to.matchScoped('h1.$b em.$b, h4.$b em.$b:first-of-type, div.$b em.$b { color: green; }');
    });

    it('sets custom css class names selectors with pseudo elements', function() {
      expect(engine.render('templates/scoped-pseudo-elements')).to.matchScoped('<div class="Text $b"> <p class="$b"><em>nacho</em> libre</p> <p>hello world</p> </div> <h1 class="$b"><em class="$b">hello h1</em></h1> <h4 class="$b"><em class="$b">hello h4</em></h4> <div class="Text"> <p>hello world</p> <p>nacho libre</p> </div>');
      expect(contents('scoped-pseudo-elements', 'css')).to.matchScoped('h1.$b em.$b, h4.$b em.$b:before { color: green; } h4.$b em.$b::before { color: green; } .Text.$b:first-child > p.$b:first-child :first-child { background-color: #ff3300; } .Text.$b:first-child > p.$b:first-child:first-letter { background-color: #ff3300; } .Text.$b:first-of-type { background-color: #aae; }');
    });

    it('ignores commented styles', function() {
      expect(contents('commented-styles', 'css')).to
        .eq('.Major { padding-bottom: var(--space-xxl); background-color: var(--major-color); } .foo { color: blue; } .header { color: red; } .content { color: orange; size: 15px; }');
    });
  });
});
