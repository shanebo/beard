// THIS FILE
// - stripping out handles
// - stripping out styles
// - stripping out frontend js
// - fixing paths in all of those different embedded blocks
// - creating distinct bundles for styles and frontend js
// - reading beard templates (without blocks) into memory cache
// - scoping css on scoped styles block
// -
// ---
// - prune unused styles
// - prune unused js


const fs = require('fs');
const fse = require('fs-extra');
const traversy = require('traversy');
const { basename, extname, resolve, dirname, relative } = require('path');
const md5 = require('md5');
const cheerio = require('cheerio');
const XRegExp = require('xregexp');
const mismatch = require('mismatch');
const { cleanWhitespace, hash } = require('./utils');
const exts = '(.beard$)';
const regex = new RegExp('(.beard$)', 'g');

// (foo|shane|boo).test('shane jack')
// bundle="alert" lang="scss"

const blockTypes = {
  ssjs: {
    type: 'ssjs',
    tagsRegex: /<script\shandle>(?<block>[\s\S]*?)<\/script>/gmi,
    pathsRegex: /(import|require)[^'"`]+['"`]([\.\/][^'"`]+)['"`]/gmi,
    ext: 'ssjs.js'
  },
  css: {
    type: 'css',
    tagsRegex: /<style(?<attributes>[^>]*)>(?<block>[\s\S]*?)<\/style>/gmi,
    validAttributes: ['bundle', 'lang', 'scoped'],
    pathsRegex: /(@import|url)\s*["'\(]*([^'"\)]+)/gmi,
    importStatement: (path) => `@import './${path}';`,
    ext: 'scss'
  },
  js: {
    type: 'js',
    // tagsRegex: /<script(?<attributes>((?!src=).)*?)>(?<block>[\s\S]+?)<\/script>/gmi,
    tagsRegex: /<script(?<attributes>[^>]*)>(?<block>[\s\S]*?)<\/script>/gmi,
    validAttributes: ['bundle', 'lang'],
    pathsRegex: /(import|require)[^'"`]+['"`]([\.\/][^'"`]+)['"`]/gmi,
    importStatement: (path) => `import './${path}';`,
    ext: 'js'
  }
};


let root;
let beardDir;
const handles = {};
const templates = {};


exports.bundle = (rootDir) => {
  root = rootDir;
  beardDir = `${root}/../.beard`;

  fse.removeSync(beardDir);
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
    const parsedTemplate = parseBlocks(contents, path);
    const { body, blocks } = parsedTemplate;

    writeBlockFiles(blocks);

    templates[key] = cleanWhitespace(body);

    if (blocks.ssjs) {
      handles[key] = require(`${beardDir}/${blocks.ssjs.file}`);
    }
  });

  writeEntryFile('css');
  writeEntryFile('js');

  return {
    templates,
    handles
  };
}


function parseBlocks(content, path) {
  let { body, blocks } = extractBlocks(content, path);

  Object.entries(blocks).forEach(([type, block]) => {
    const blockType = blockTypes[type];
    const { importStatement, ext, pathsRegex } = blockType;

    if (block.scoped) {
      const scopedCSS = scopeCSS(path, block.content, body);
      block.content = scopedCSS.styles;
      body = scopedCSS.body;
    }

    block.content = fixPaths(path, block.content, pathsRegex);
    block.file = getHashedPath(path, block.content, block.lang || ext);

    let { bundle } = block;

    if (type !== 'ssjs') {
      if (!bundle) {
        bundle = 'entry';
      }

      if (!blockType.bundles[bundle]) {
        blockType.bundles[bundle] = [];
      }

      blockType.bundles[bundle].push(importStatement(block.file));
    }
  });

  return {
    body,
    blocks
  };
}


function extractBlocks(body, path) {
  const blocks = {};

  Object.entries(blockTypes).forEach(([type, blockType]) => {
    const { tagsRegex, validAttributes } = blockType;

    body = body.replace(tagsRegex, function(){
      const captures = arguments[arguments.length - 1];
      const block = {
        content: captures.block
      };

      if (captures.attributes) {
        const attributes = mismatch(/\s*([^=]+)(?:="(.+?)")?/gmi, captures.attributes, ['name', 'value']);
        const hasValidAttributes = attributes.every(attr => validAttributes.includes(attr.name));

        if (!attributes.length || !hasValidAttributes) {
          return arguments[0];
        }

        attributes.forEach((attr) => {
          block[attr.name] = attr.value || true;
        });
      }

      blocks[type] = block;
      return '';
    });
  });

  return {
    body,
    blocks
  }
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

function getHashedPath(path, block, ext) {
  const assetHash = md5(block).slice(-8);
  return `${basename(path, extname(path))}.${assetHash}.${ext}`;
}

function fixPaths(path, block, pathsRegex) {
  return block.replace(pathsRegex, (match, _, importPath) => {
    const abImportPath = resolve(root, dirname(path), importPath);
    const newImportPath = relative(beardDir, abImportPath);
    return match.replace(importPath, newImportPath);
  });
}

function scopeCSS(path, blockContent, body) {
  const $ = cheerio.load(body, {
    withDomLvl1: false,
    normalizeWhitespace: false,
    xmlMode: true,
    decodeEntities: false
  });

  const styles = replaceSelectors(blockContent, (declaration) => {
    const { name, content, selectors } = declaration;
    const scopedClass = `.beard-${hash(path.replace(root, '') + name + content)}`;
    selectors.forEach(selector => {
      if ($(selector)) {
        $(selector).addClass(scopedClass.replace(/^\./, ''));
      }
    });
    return scopedClass;
  });

  return {
    styles,
    body: $.html()
  };
}

function replaceSelectors(css, callback) {
  const matches = XRegExp.matchRecursive(css, '{', '}', 'g', {
    valueNames: ['name', null, 'style', null]
  });

  return matches
    .map((match, m) => {
      if (match.name === 'name' && match.value.trim()) {
        return {
          name: match.value,
          selectors: match.value.split(',').map(name => name.trim()).filter(name => ![':', '/*', '//'].includes(name)),
          content: matches[m + 1].value
        };
      }
    })
    .filter(match => match)
    .map(style => {
      if (style.name.trim().startsWith('@')) {
        const mediaStyles = replaceSelectors(style.content, callback);
        return `${style.name} {${mediaStyles}}`;
      } else {
        return `${callback(style)} {${style.content}}`;
      }
    }).join('\n');
}
