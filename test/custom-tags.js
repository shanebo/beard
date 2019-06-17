const { expect } = require('chai');
const normalize = require('path').normalize;
const fs = require('fs');

const beard = require('../lib/index');

describe('Custom Tags', function() {
  it('allows custom tags to be set', function() {
    const engine = beard({
      templates: {
        '/views/content': `{{asset '../images/calvin.png'}}`,
      },
      customTags: {
        asset: {
          render: (path) => `/dist${path}`,
          firstArgIsResolvedPath: true,
          content: false
        }
      }
    });
    expect(engine.render('/views/content')).to.equal('/dist/images/calvin.png');
  });

  it('allows custom tags that do not process the first arg as a path', function() {
    const engine = beard({
      templates: {
        '/view': `{{tag 'a', {href: 'www.google.com', link: 'google'}}}`
      },
      customTags: {
        tag: {
          render: (tagName, data) => `<${tagName} href="${data.href}">${data.link}</${tagName}>`,
          firstArgIsResolvedPath: false,
          content: false
        }
      }
    });
    expect(engine.render('/view').replace(/\s+/g, ' ')).to.equal('<a href="www.google.com">google</a>');
  });

  it('allows custom tags with data', function() {
    const engine = beard({
      templates: {
        '/view': `{{asset '/calvin.png'}} page {{component 'simple', {title: 'Foo'}}}`,
        '/components/simple': '{{title}} component'
      },
      customTags: {
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
    expect(engine.render('view', {assetName: 'calvin.png', componentName: 'simple', other: 'foo_bar'}))
      .to.equal('/dist/calvin.png page Foo component The Foo Bar');
  });

  it('handles custom tags with block content', function() {
    const engine = beard({
      templates: {
        '/templates/view': `
          top
          {{component:content '../header'}}
            <h1>hello world</h1>
          {{endcomponent}}`,
        '/header': '{{content}} component'
      },
      customTags: {
        component: {
          render: (path, data) => engine.render(path, data),
          firstArgIsResolvedPath: true,
          content: true
        }
      }
    });
    expect(engine.render('/templates/view').replace(/\s+/g, ' ')).to.equal(' top <h1>hello world</h1> component');
  });

  it('handles custom tags with block content and data', function() {
    const engine = beard({
      templates: {
        '/templates/view': `
          top
          {{component:content '../header', {title: 'the title'}}}
            <h1>hello world</h1>
          {{endcomponent}}`,
        '/header': '{{content}} {{title}} component'
      },
      customTags: {
        component: {
          render: (path, data) => engine.render(path, data),
          firstArgIsResolvedPath: true,
          content: true
        }
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
      customTags: {
        component: {
          render: (path, data) => engine.render(path, data),
          firstArgIsResolvedPath: true,
          content: true
        }
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
          {{component:content '../header'}}
            <h1>hello world</h1>
          {{endcomponent}}`,
        '/header': '{{content}} component',
        '/layout': 'begin {{nav}} {{content}} end'
      },
      customTags: {
        component: {
          render: (path, data) => engine.render(path, data),
          firstArgIsResolvedPath: true,
          content: true
        }
      }
    });
    expect(engine.render('/templates/view').replace(/\s+/g, ' ')).
      to.equal('begin the nav top <h1>hello world</h1> component end');
  });
});
