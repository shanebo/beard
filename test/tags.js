const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const beard = require('../lib/index');


describe('Tags', function() {
  it('allows tags to be set', function() {
    const engine = beard({
      templates: {
        '/views/content': `{{asset '../images/calvin.png'}}`,
      },
      tags: {
        asset: {
          render: (path) => `/dist${path}`,
          firstArgIsResolvedPath: true,
          content: false
        }
      }
    });
    assert.equal(engine.render('/views/content'), '/dist/images/calvin.png');
  });

  it('allows tags that do not process the first arg as a path', function() {
    const engine = beard({
      templates: {
        '/view': `{{beardTag 'a', {href: 'www.google.com', link: 'google'}}}`
      },
      tags: {
        beardTag: {
          render: (tagName, data) => `<${tagName} href="${data.href}">${data.link}</${tagName}>`,
          firstArgIsResolvedPath: false,
          content: false
        }
      }
    });
    assert.equal(engine.render('/view').replace(/\s+/g, ' '), '<a href="www.google.com">google</a>');
  });

  it('allows tags with data', function() {
    const engine = beard({
      templates: {
        '/view': `{{asset '/calvin.png'}} page {{component 'simple', {title: 'Foo'}}}`,
        '/components/simple': '{{title}} component'
      },
      tags: {
        asset: {
          render: (path) => `/dist${path}`,
          firstArgIsResolvedPath: true,
          content: false
        },
        component: {
          render: (path, data) => engine.render('/components' + path, data),
          firstArgIsResolvedPath: true,
          content: false
        }
      }
    });
    assert.equal(engine.render('view'), '/dist/calvin.png page Foo component');
  });

  it('allows tags with dynamic paths', function() {
    const engine = beard({
      templates: {
        '/view': "{{asset assetName}} page {{component `/components/${componentName}`, {title: 'Foo'}}} {{component other.replace('_', '-'), {name: 'Foo Bar'}}}",
        '/components/simple': '{{title}} component',
        '/foo-bar': 'The {{name}}'
      },
      tags: {
        asset: {
          render: (path) => `/dist${path}`,
          firstArgIsResolvedPath: true,
          content: false
        },
        component: {
          render: (path, data) => engine.render(path, data),
          firstArgIsResolvedPath: true,
          content: false
        }
      }
    });
    assert.equal(
      engine.render('view', {assetName: 'calvin.png', componentName: 'simple', other: 'foo_bar'}),
      '/dist/calvin.png page Foo component The Foo Bar'
    );
  });

  it('handles tags with block content', function() {
    const engine = beard({
      templates: {
        '/templates/view': `
          top
          {{component:content '../header'}}
            <h1>hello world</h1>
          {{endcomponent}}`,
        '/header': '{{content}} component'
      },
      tags: {
        component: {
          render: (path, data) => engine.render(path, data),
          firstArgIsResolvedPath: true,
          content: true
        }
      }
    });
    assert.equal(engine.render('/templates/view').replace(/\s+/g, ' '), ' top <h1>hello world</h1> component');
  });

  it('handles tags with block content and data', function() {
    const engine = beard({
      templates: {
        '/templates/view': `
          top
          {{component:content '../header', {title: 'the title'}}}
            <h1>hello world</h1>
          {{endcomponent}}`,
        '/header': '{{content}} {{title}} component'
      },
      tags: {
        component: {
          render: (path, data) => engine.render(path, data),
          firstArgIsResolvedPath: true,
          content: true
        }
      }
    });
    assert.equal(engine.render('/templates/view').replace(/\s+/g, ' '), ' top <h1>hello world</h1> the title component');
  });

  it('handles tags with block content and inline blocks', function() {
    const engine = beard({
      templates: {
        '/templates/view': `
          top
          {{component:content '../header'}}
            {{block button}}
               a button
            {{endblock}}

            {{block actions}}
                some actions
            {{endblock}}
            <h1>hello world</h1>
          {{endcomponent}}`,
        '/header': '{{content}} {{button}} {{actions}} component'
      },
      tags: {
        component: {
          render: (path, data) => engine.render(path, data),
          firstArgIsResolvedPath: true,
          content: true
        }
      }
    });
    assert.equal(engine.render('/templates/view').replace(/\s+/g, ' '), ' top <h1>hello world</h1> a button some actions component');
  });

  it('handles tags with block content, inline blocks and data', function() {
    const engine = beard({
      templates: {
        '/templates/view': `
          top
          {{component:content '../header', { button: 'data button' }}}
            {{block actions}}
                some actions
            {{endblock}}
            <h1>hello world</h1>
          {{endcomponent}}`,
        '/header': '{{content}} {{button}} {{actions}} component'
      },
      tags: {
        component: {
          render: (path, data) => engine.render(path, data),
          firstArgIsResolvedPath: true,
          content: true
        }
      }
    });
    assert.equal(engine.render('/templates/view').replace(/\s+/g, ' '), ' top <h1>hello world</h1> data button some actions component');
  });

  it('handles tags with block content, data and subcomponents', function() {
    const engine = beard({
      templates: {
        '/templates/view': `
          top
          {{component:content '../header',
            {
              title: 'the title'
            }}}
            <h1>hello world</h1>
            {{component '/sub'}}
          {{endcomponent}}`,
        '/header': '{{content}} {{title}} component',
        '/sub': 'the sub!'
      },
      tags: {
        component: {
          render: (path, data) => engine.render(path, data),
          firstArgIsResolvedPath: true,
          content: true
        }
      }
    });
    assert.equal(engine.render('/templates/view').replace(/\s+/g, ' '), ' top <h1>hello world</h1> the sub! the title component');
  });

  it('handles tags with block content and extended layouts', function() {
    const engine = beard({
      templates: {
        '/templates/view': `
          {{extends '../layout'}}
          top
          {{block nav}}the nav{{endblock}}
          {{component:content '../header'}}
            <h1>hello world</h1>
          {{endcomponent}}`,
        '/header': '{{content}} component',
        '/layout': 'begin {{nav}} {{content}} end'
      },
      tags: {
        component: {
          render: (path, data) => engine.render(path, data),
          firstArgIsResolvedPath: true,
          content: true
        }
      }
    });
    assert.equal(engine.render('/templates/view').replace(/\s+/g, ' '), 'begin the nav top <h1>hello world</h1> component end');
  });
});
