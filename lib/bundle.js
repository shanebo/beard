// - stripping out handles
// - stripping out styles
// - stripping out frontend js
// - fixing paths in all of those different embedded blocks
// - creating distinct bundles for styles and frontend js
// - reading beard templates (without blocks) into memory cache
// - scoping css on scoped styles block
// --- TODO
// - prune unused styles
// - prune unused js


const fs = require('fs');
const fse = require('fs-extra');
const traversy = require('traversy');
const { basename, extname, resolve, dirname, relative } = require('path');
const { vdom, cleanWhitespace, hash, removeExtension } = require('./utils');
const XRegExp = require('xregexp');
const exts = '(.beard$)';
const regex = new RegExp('(.beard$)', 'g');
const normalizeSelector = require('normalize-selector');

const blockTypes = {
  ssjs: {
    type: 'ssjs',
    tag: 'script[handle]',
    pathsRegex: /(import|require)[^'"`]+['"`]([\.\/][^'"`]+)['"`]/gmi,
    ext: 'ssjs.js'
  },
  css: {
    type: 'css',
    tag: 'style',
    pathsRegex: /(@import|url)\s*["'\(]*([^'"\)]+)/gmi,
    importStatement: (path) => `@import './${path}';`,
    ext: 'scss'
  },
  js: {
    type: 'js',
    tag: 'script:not(script[handle]):not(script[inline]):not(script[src])',
    pathsRegex: /(import|require)[^'"`]+['"`]([\.\/][^'"`]+)['"`]/gmi,
    importStatement: (path) => `import './${path}';`,
    ext: 'js'
  }
};

const combinators = ['>', '+', '~'];
const deepCombinator = '>>>'; // this is our custom deep combinator for decendant scoping
const psuedoElements = /::after|:after|::backdrop|::after|:after|::backdrop|::before|:before|::cue|:cue|::first-letter|:first-letter|::first-line|:first-line|::grammar-error|::marker|::part\(.*?\)|::placeholder|::selection|::slotted\(.*?\)|::spelling-error/;

let root;
let beardDir;
const handles = {};
const templates = {};


exports.bundle = (opts) => {
  root = opts.root;
  beardDir = `${root}/../.beard`;

  fse.ensureDirSync(beardDir);

  blockTypes.css.bundles = {
    entry: []
  };

  blockTypes.js.bundles = {
    entry: []
  };

  traversy(root, exts, (path) => {
    const key = path.replace(regex, '');
    const contents = fs.readFileSync(path, 'utf8');
    const template = /<template>[\s\S]*?<\/template>/gm.test(contents)
      ? contents
      : `<template>${contents}</template>`;

    const original$ = vdom(template);
    const blocks = parseBlocks(original$, path);
    const $ = vdom(cleanWhitespace(original$('template').html()));
    const whitespaceTagsSelectors = 'pre, code, textarea';
    const originalWhitespaceTags = original$(whitespaceTagsSelectors);
    const whitespaceTags = $(whitespaceTagsSelectors);

    originalWhitespaceTags.each((i, el) => {
      $(whitespaceTags[i]).replaceWith(el);
    });

    const body = $.html().replace(/=\"=(=?)\"/gm, '==$1');

    writeBlockFiles(blocks);

    if (process.env.NODE_ENV !== 'production') {
      fs.writeFileSync(`${beardDir}/${getHashedPath(path, 'beard')}`, body);
    }

    if (opts.loadHandles && blocks.ssjs) {
      handles[key] = require(`${beardDir}/${blocks.ssjs.file}`);
    }

    templates[key] = body;
  });

  writeEntryFile('css');
  writeEntryFile('js');

  return {
    templates,
    handles
  };
}


function parseBlocks($, path) {
  const blocks = extractBlocks($, path);

  Object.entries(blocks).forEach(([type, block]) => {
    const blockType = blockTypes[type];
    const { importStatement, ext, pathsRegex } = blockType;

    if (block.hasOwnProperty('scoped')) {
      block.content = scopeCSS(path, block.content, $);
    }

    block.content = fixPaths(path, block.content, pathsRegex);
    block.file = getHashedPath(path, block.lang || ext);

    let { bundle } = block;

    if (type !== 'ssjs') {
      if (!bundle) {
        bundle = ['entry'];
      } else {
        bundle = bundle.split(',').filter(b => b).map(b => b.trim());
      }

      bundle.forEach((b) => {
        if (!blockType.bundles[b]) {
          blockType.bundles[b] = [];
        }

        blockType.bundles[b].push(importStatement(block.file));
      });
    }
  });

  return blocks;
}


function extractBlocks($) {
  const blocks = {};

  Object.entries(blockTypes).forEach(([type, blockType]) => {
    const { tag } = blockType;

    $(tag).each((i, el) => {
      const block = { ...{ content: $(el).get()[0].children[0].data }, ...el.attribs };
      blocks[type] = block;
      $(el).remove();
    });
  });

  return blocks;
}

function writeBlockFiles(blocks) {
  Object.entries(blocks).forEach(([key, block]) => {
    fs.writeFileSync(`${beardDir}/${block.file}`, block.content);
  });
}

function writeEntryFile(type) {
  const { bundles } = blockTypes[type];
  Object.keys(bundles).forEach((bundle) => {
    fs.writeFileSync(`${beardDir}/${bundle}.${type}`, bundles[bundle].join('\n'));
  });
}

function getHashedPath(path, ext) {
  return `${basename(path, extname(path))}.${hash(path)}.${ext}`;
}

function fixPaths(path, block, pathsRegex) {
  return block.replace(pathsRegex, (match, _, importPath) => {
    const abImportPath = resolve(root, dirname(path), importPath);
    const newImportPath = relative(beardDir, abImportPath);
    return match.replace(importPath, newImportPath);
  });
}

function scopeCSS(path, blockContent, $) {
  const styles = replaceSelectors(blockContent, (selectors) => {
    const scopedClass = `.b-${hash(removeExtension(path))}`;

    return selectors.map(origSelector => {
      let hasDeepCombinator = false;

      return origSelector.reduce((selector, part) => {
        if (!hasDeepCombinator && part === deepCombinator) {
          hasDeepCombinator = true;
          return selector;
        }

        if (hasDeepCombinator || combinators.includes(part) || part.startsWith(':')) {
          // this part is not a queryable element, so it doesn't need a scoped css class
          return `${selector} ${part}`;
        }

        const el = `${selector} ${part.replace(psuedoElements, '')}`;

        if ($(el)) {
          $(el).addClass(scopedClass.substring(1));
        }

        return `${selector} ${part.replace(/([^:]+)(:.+)?/, `$1${scopedClass}$2`)}`;
      }, '').trim();
    }).join(',\n');
  });

  return styles;
}

function validStyle(val) {
  if (!val) return false;
  const notCommentedOut = !val.trim().match(/^(\/\*)|(\/\/)/);
  if (notCommentedOut) return true;
  return false;
}

function replaceSelectors(css, callback) {
  const matches = XRegExp.matchRecursive(css, '{', '}', 'g', {
    valueNames: ['name', null, 'style', null]
  });

  return matches
    .map((match, m) => {
      const val = normalizeSelector(match.value).replace('> > >', deepCombinator);
      if (match.name === 'name' && validStyle(val)) {
        return {
          name: val,
          selectors: val
            .split(',')
            .filter(name => !['/*', '//'].includes(name.trim().substring(0, 2)))
            .map(name => name.trim().split(/\s+/)),
          content: matches[m + 1].value
        };
      }
    })
    .filter(match => match)
    .map(style => {
      if (style.name.trim().startsWith('@')) {
        const mediaQueryStyles = replaceSelectors(style.content, callback);
        return `${style.name} {${mediaQueryStyles}}`;
      } else {
        return `${callback(style.selectors)} {${style.content}}`;
      }
    }).join('\n');
}
