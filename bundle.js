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
    tag: 'script[handle]',
    tagsRegex: /<script\shandle>(?<block>[\s\S]*?)<\/script>/gmi,
    pathsRegex: /(import|require)[^'"`]+['"`]([\.\/][^'"`]+)['"`]/gmi,
    ext: 'ssjs.js'
  },
  css: {
    type: 'css',
    tag: 'style',
    tagsRegex: /<style(?<attributes>[^>]*)>(?<block>[\s\S]*?)<\/style>/gmi,
    validAttributes: ['bundle', 'lang', 'scoped'],
    pathsRegex: /(@import|url)\s*["'\(]*([^'"\)]+)/gmi,
    importStatement: (path) => `@import './${path}';`,
    ext: 'scss'
  },
  js: {
    type: 'js',
    tag: 'script:not(script[handle]):not(script[src])',
    tagsRegex: /<script(?<attributes>((?!src=).)*?)>(?<block>[\s\S]+?)<\/script>/gmi,
    // tagsRegex: /<script(?<attributes>[^>]*)>(?<block>[\s\S]*?)<\/script>/gmi,
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


let removeTags = [];


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
    // const contents = fs.readFileSync(path, 'utf8').replace(/(?=<!--)([\s\S]*?)-->/gm, '');
    // removes commented out blocks first
    const contents = fs.readFileSync(path, 'utf8');

    removeTags = [/<html.*?>/gm, /<\/html>/gm, /<body.*?>/gm, /<\/body>/gm, /<head>/gm, /<\/head>/gm].filter(regex => !regex.test(contents));

    const $ = cheerio.load(contents, {
      withDomLvl1: false,
      normalizeWhitespace: false,
      xmlMode: false,
      decodeEntities: false,
      lowerCaseAttributeNames: false
      // xml: {
      //   decodeEntities: false,
      //   lowerCaseAttributeNames: false
      // }
    });

    // const $ = cheerio.load(contents, {
    //   withDomLvl1: false,
    //   normalizeWhitespace: true,
    //   xmlMode: false,
    //   decodeEntities: false,
    //   lowerCaseAttributeNames: false
    // });


    // console.log('\n\n\n\n');
    // console.log($.html().replace(/=""/gm, ''));


    const blocks = parseBlocks($, path);

    // console.log('\n\n\n');
    // console.log({ blocks });


    writeBlockFiles(blocks);


    const body = cleanWhitespace(removeTags.reduce((html, regex) => html.replace(regex, ''), $.html()).replace(/=\"=\"/gm, '==').replace(/=\"==\"/gm, '==='));
    templates[key] = body;


    // templates[key] = cleanWhitespace($.html());
    // templates[key] = cleanWhitespace($.html().replace(/=\\"\\"/gm, ''));
    // templates[key] = cleanWhitespace($.html().replace(/^<html><head><\/head><body>|<\/body><\/html>$/gm, ''));

    fs.writeFileSync(`${beardDir}/${getHashedPath(path, body, 'beard')}`, body);

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


function parseBlocks($, path) {
  const blocks = extractBlocks($, path);

  Object.entries(blocks).forEach(([type, block]) => {
    const blockType = blockTypes[type];
    const { importStatement, ext, pathsRegex } = blockType;

    if (block.hasOwnProperty('scoped')) {
      block.content = scopeCSS(path, block.content, $);
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

  return blocks;
}


function extractBlocks($) {
  const blocks = {};

  Object.entries(blockTypes).forEach(([type, blockType]) => {
    const { tag } = blockType;

    $(tag).each((i, el) => {
      const block = { ...{ content: $(el).get()[0].children[0].data }, ...el.attribs };
      // const block = { ...{ content: $(el).text() }, ...el.attribs };
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

function scopeCSS(path, blockContent, $) {
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

  return styles;
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
