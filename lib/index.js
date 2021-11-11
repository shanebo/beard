const { defaultTag, parsers } = require('./statements');
const { resolvePath, compile } = require('./compile');


class Beard {
  constructor(opts = {}) {
    opts.templates = opts.templates || {};
    opts.tags = opts.tags || {};

    this.opts = opts;
    this.opts.tags = { ...defaultTag, ...opts.tags };
    this.fns = {};

    this.configureTags(this.opts.tags);

    if (this.opts.shortcuts) {
      this.configureShortcuts(this.opts.shortcuts, this.opts.tags);
    }
  }

  configureTags(tags) {
    parsers.tag = new RegExp(`^(${Object.keys(tags).join('|')})\\\s+([^,]+)(?:,\\\s*([\\\s\\\S]*))?$`);
    const contentTags = Object.keys(tags).filter((key) => tags[key].content).join('|');

    if (contentTags.length) {
      parsers.contentTag = new RegExp(`^(${contentTags})\\\:content\\\s+([^,]+)(?:,\\\s*([\\\s\\\S]*))?$`);
      parsers.endTag = new RegExp(`^end(${contentTags})$`);
    }
  }

  configureShortcuts(shortcuts, tags) {
    parsers.shortcut = new RegExp(`^@(${Object.keys(shortcuts).join('|')})(?:(?:\\\s+)([\\\s\\\S]+))?$`);
    const contentTags = Object.keys(shortcuts).filter((key) => tags[shortcuts[key].tag].content).join('|');

    if (contentTags.length) {
      parsers.shortcutContent = new RegExp(`^@(${contentTags})\\\:content(?:(?:\\\s+)([\\\s\\\S]+))?$`);
      parsers.endShortcut = new RegExp(`^end(${contentTags})$`);
    }
  }

  compiled(path, parentPath = '') {
    path = resolvePath(path, parentPath, this.opts.root);
    const str = this.opts.templates[path];

    if (process.env.NODE_ENV === 'development' || !this.fns[path]) {
      this.fns[path] = compile(str, path);
    }

    return this.fns[path];
  }

  tag(name, parentPath, firstArg, data) {
    if (this.opts.tags[name].firstArgIsResolvedPath) {
      firstArg = resolvePath(firstArg, parentPath, this.opts.root);
    }

    return this.opts.tags[name].render(
        firstArg,
        data,
        this.render.bind(this),
        this.partial.bind(this)
      );
  }

  shortcut(name, parentPath, data) {
    const tag = this.opts.shortcuts[name].tag;
    const path = this.opts.shortcuts[name].path;
    return this.tag(tag, parentPath, path, data);
  }

  include(context, parentPath, path, data) {
    context.locals.push(data);
    const result = context.compiled(path, parentPath)(context);
    context.locals.pop();
    return result;
  }

  partial(str, data) {
    const context = {
      globals: {},
      locals: [data],
      compiled: this.compiled.bind(this),
      include: this.include.bind(this),
      tag: this.tag.bind(this),
      shortcut: this.shortcut.bind(this)
    };

    return compile(str, this.opts.root || '/')(context);
  }

  render(path, data = {}) {
    const context = {
      globals: {},
      locals: [data],
      compiled: this.compiled.bind(this),
      include: this.include.bind(this),
      tag: this.tag.bind(this),
      shortcut: this.shortcut.bind(this)
    };

    if (this.opts.root && !path.startsWith('/')) {
      path = `${this.opts.root}/${path}`;
    }

    return this.compiled(path)(context);
  }
}


module.exports = (opts) => new Beard(opts);
