const beard = require('../lib/index');
const { expect } = require('chai');

describe('Shortcuts', function() {
  it('allows shortcuts to be set for tags', function() {
    const engine = beard({
      templates: {
        '/views/content': `{{@logo}}`,
      },
      tags: {
        asset: {
          render: (path) => `/dist${path}`,
          firstArgIsResolvedPath: true,
          content: false
        }
      },
      shortcuts: {
        logo: {
          tag: 'asset',
          path: '/images/logo.png'
        }
      }
    });
    expect(engine.render('/views/content')).to.equal('/dist/images/logo.png');
  });

  it('allows shortcuts with data', function() {
    const engine = beard({
      templates: {
        '/views/content': `{{@header {title: 'Welcome To The'}}}`,
        '/header': '{{title}} component'
      },
      tags: {
        component: {
          render: (path, data) => engine.render(path, data),
          firstArgIsResolvedPath: true,
          content: true
        }
      },
      shortcuts: {
        header: {
          tag: 'component',
          path: '/header'
        }
      }
    });
    expect(engine.render('/views/content')).to.equal('Welcome To The component');
  });

  it('allows shortcuts with block content', function() {
    const engine = beard({
      templates: {
        '/templates/view': `
          top
          {{@header:content {title: 'title'}}}
            some content
          {{endheader}}`,
        '/header': '{{title}} {{content}}'
      },
      tags: {
        component: {
          render: (path, data) => engine.render(path, data),
          firstArgIsResolvedPath: true,
          content: true
        }
      },
      shortcuts: {
        header: {
          tag: 'component',
          path: '/header'
        }
      }
    });
    expect(engine.render('/templates/view').replace(/\s+/g, ' ')).
      to.equal(' top title some content ');
  });

  it('allows shortcuts with block content and inline blocks', function() {
    const engine = beard({
      templates: {
        '/templates/view': `
          top
          {{@header:content}}
            {{block button}}
               a button
            {{endblock}}

            {{block actions}}
                some actions
            {{endblock}}
            <h1>hello world</h1>
          {{endheader}}`,
        '/header': '{{content}} {{button}} {{actions}} component'
      },
      tags: {
        component: {
          render: (path, data) => engine.render(path, data),
          firstArgIsResolvedPath: true,
          content: true
        }
      },
      shortcuts: {
        header: {
          tag: 'component',
          path: '/header'
        }
      }
    });
    expect(engine.render('/templates/view').replace(/\s+/g, ' ')).
      to.equal(' top <h1>hello world</h1> a button some actions component');
  });

  it('allows shortcuts with block content, inline blocks, and data', function() {
    const engine = beard({
      templates: {
        '/templates/view': `
          top
          {{@header:content { button: 'data button' }}}
            {{block actions}}
                some actions
            {{endblock}}
            <h1>hello world</h1>
          {{endheader}}`,
        '/header': '{{content}} {{button}} {{actions}} component'
      },
      tags: {
        component: {
          render: (path, data) => engine.render(path, data),
          firstArgIsResolvedPath: true,
          content: true
        }
      },
      shortcuts: {
        header: {
          tag: 'component',
          path: '/header'
        }
      }
    });
    expect(engine.render('/templates/view').replace(/\s+/g, ' ')).
      to.equal(' top <h1>hello world</h1> data button some actions component');
  });

  it('allows shortcuts with periods in the name', function() {
    const engine = beard({
      templates: {
        '/view': `
          top
          {{@page.info:content {title: 'page'}}}
            info
          {{endpage.info}}`,
        '/components/info': '{{title}} {{content}}'
      },
      tags: {
        component: {
          render: (path, data) => engine.render(path, data),
          firstArgIsResolvedPath: true,
          content: true
        }
      },
      shortcuts: {
        'page.info': {
          tag: 'component',
          path: '/components/info'
        }
      }
    });
    expect(engine.render('/view').replace(/\s+/g, ' ')).
      to.equal(' top page info ');
  });
});
