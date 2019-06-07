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


const blockTypes = [
  {
    type: 'ssjs',
    tagsRegex: /<script\shandle>(?<block>[\s\S]*?)<\/script>/gmi,
    pathsRegex: /(import|require)[^'"`]+['"`]([\.\/][^'"`]+)['"`]/gmi,
    ext: 'ssjs.js'
  },
  {
    type: 'css',
    tagsRegex: /<style(?<attributes>[^>]*)>(?<block>[\s\S]*?)<\/style>/gmi,
    validAttributes: ['bundle', 'lang', 'scoped'],
    pathsRegex: /(@import|url)\s*["'\(]*([^'"\)]+)/gmi,
    importStatement: (path) => `@import './${path}';`,
    ext: 'scss'
  },
  {
    type: 'js',
    tagsRegex: /<script(?<attributes>[^>]*)>(?<block>[\s\S]*?)<\/script>/gmi,
    validAttributes: ['bundle', 'lang'],
    pathsRegex: /(import|require)[^'"`]+['"`]([\.\/][^'"`]+)['"`]/gmi,
    importStatement: (path) => `import './${path}';`,
    ext: 'js'
  }
];


let root;
let beardDir;
const handles = {};
const templates = {};


exports.bundle = (rootDir) => {
  root = rootDir;
  beardDir = `${root}/../.beard`;

  fse.removeSync(beardDir);
  fse.ensureDirSync(beardDir);

  blockTypes[1].bundles = {
    entry: []
  };
  blockTypes[2].bundles = {
    entry: []
  };

  traversy(root, exts, (path) => {
    const key = path.replace(regex, '');
    const contents = fs.readFileSync(path, 'utf8');
    const parsedTemplate = extractBlocks(contents, path);
    const { body, blocks } = parsedTemplate;

    writeBlockFiles(blocks);

    templates[key] = cleanWhitespace(body);

    if (blocks.ssjs) {
      handles[key] = require(`${beardDir}/${blocks.ssjs.file}`);
    }
  });

  writeEntryFiles();

  return {
    templates,
    handles
  };
}

// deleting blocks and determining the contents of the block file
function extractBlocks(body, path) {
  const blocks = {};

  blockTypes.forEach((blockType) => {
    const { type, tagsRegex, validAttributes, importStatement, pathsRegex, ext } = blockType;

    body = body.replace(tagsRegex, function(){
      const captures = arguments[arguments.length - 1];
      const block = {
        block: fixPaths(path, captures.block, pathsRegex)
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


  blockTypes.forEach((blockType) => {
    const { type, tagsRegex, validAttributes, importStatement, pathsRegex, ext } = blockType;

    // later fix where we iterate through blocks instead of blockTypes
    const block = blocks[type];
    if (!block) return;

    if (block.scoped) {
      const scopedCSS = scopeStyles(path, block.block, body);
      block.block = scopedCSS.styles;
      body = scopedCSS.body;
    }

    block.file = getHashedPath(path, block.block, block.lang || ext);

    // do type specific things
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

  blocks.body = body;

  // console.log({ blocks });
  return {
    body,
    blocks
  };
}

function writeBlockFiles(blocks) {
  Object.entries(blocks).forEach(([key, value]) => {
    const { block, file } = value;
    fs.writeFileSync(`${beardDir}/${file}`, block);
  });
}

function writeEntryFiles() {
  [blockTypes[1], blockTypes[2]].forEach((blockType) => {
    Object.keys(blockType.bundles).forEach((bundle) => {
      fs.writeFileSync(`${beardDir}/${bundle}.${blockType.type}`, blockType.bundles[bundle].join('\n'));
    });
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

function scopeStyles(path, content, body) {
  const $ = cheerio.load(body, {
    withDomLvl1: false,
    normalizeWhitespace: false,
    xmlMode: true,
    decodeEntities: false
  });

  const styles = replaceStyleNames(content, (styleDeclaration) => {
    const { name, style, selectors } = styleDeclaration;
    const scopedClassName = `.beard-${hash(path.replace(root, '') + name + style)}`;
    selectors.forEach(selector => {
      if ($(selector)) {
        $(selector).addClass(scopedClassName.replace(/^\./, ''));
      }
    });
    return scopedClassName;
  });

  return {
    styles,
    body: $.html()
  };
}

function replaceStyleNames(css, callback) {
  const matches = XRegExp.matchRecursive(css, '{', '}', 'g', {
    valueNames: ['name', null, 'style', null]
  });

  return matches
    .map((match, m) => {
      if (match.name === 'name' && match.value.trim()) {
        return {
          name: match.value,
          selectors: match.value.split(',').map(name => name.trim()).filter(name => ![':', '/*', '//'].includes(name)),
          style: matches[m + 1].value
        };
      }
    })
    .filter(match => match)
    .map(style => {
      if (style.name.startsWith('@')) {
        const mediaStyles = replaceStyleNames(style.style, callback);
        return `${callback(style)} {${mediaStyles}}`;
      } else {
        return `${callback(style)} {${style.style}}`;
      }
    }).join('\n');
}
