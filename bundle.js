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
    attributesRegex: /(bundle|lang|scoped)(?:="(.+?)")?/gmi,
    validAttributes: ['bundle', 'lang', 'scoped'],
    pathsRegex: /(@import|url)\s*["'\(]*([^'"\)]+)/gmi,
    importStatement: (path) => `@import './${path}';`,
    ext: 'scss'
  },
  {
    type: 'js',
    tagsRegex: /<script(?<attributes>[^>]*)>(?<block>[\s\S]*?)<\/script>/gmi,
    attributesRegex: /(bundle)(?:="(.+?)")?/gmi,
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
    const body = bundleBlocks(path, key);
    templates[key] = cleanWhitespace(body);
  });

  writeAssetEntryFiles();

  return {
    templates,
    handles
  };
}


function writeAssetEntryFiles() {
  [blockTypes[1], blockTypes[2]].forEach((blockType) => {
    Object.keys(blockType.bundles).forEach((bundle) => {
      fs.writeFileSync(`${beardDir}/${bundle}.${blockType.type}`, blockType.bundles[bundle].join('\n'));
    });
  });
}

function bundleBlocks(path, key) {
  let body = fs.readFileSync(path, 'utf8');

  blockTypes.forEach((blockType) => {
    const { type, ext, tagsRegex, validAttributes, pathsRegex, importStatement } = blockType;

    const blockMatches = [];
    body = body.replace(tagsRegex, function(){
      const args = [...arguments];
      const captures = args[args.length - 1];
      const blockMatch = { block: captures.block };

      if (captures.attributes) {
        const attributes = mismatch(/\s*([^=]+)(?:="(.+?)")?/gmi, captures.attributes, ['name', 'value']);

        console.log({ attributes });


        if (!attributes.length || !attributes.every(attr => validAttributes.includes(attr.name))) return args[0];

        attributes.forEach((attr) => {
          blockMatch[attr.name] = attr.value || attr.name;
        });
      }

      blockMatches.push(blockMatch);
      return '';
    });

    blockMatches.forEach((blockMatch) => {
      let { scoped, bundle, lang, block } = blockMatch;
      let bundleName = bundle;

      block = fixPaths(path, block, pathsRegex);

      if (type === 'css' && scoped) {
        const scopedCSS = scopeStyles(path, block, body);
        block = scopedCSS.styles;
        body = scopedCSS.body;
      }

      const assetHash = md5(block).slice(-8);
      const partialPath = `${basename(path, extname(path))}.${assetHash}.${lang || ext}`;
      fs.writeFileSync(`${beardDir}/${partialPath}`, block);

      if (blockType.bundles) {
        if (!bundleName) {
          bundleName = 'entry';
        }

        if (!blockType.bundles[bundleName]) {
          blockType.bundles[bundleName] = [];
        }

        blockType.bundles[bundleName].push(importStatement(partialPath));

      } else {
        handles[key] = require(`${beardDir}/${partialPath}`);
      }
    });
  });

  return body;
}




function fixPaths(path, block, pathsRegex) {
  return block.replace(pathsRegex, (match, _, importPath) => {
    const abImportPath = resolve(root, dirname(path), importPath);
    const newImportPath = relative(beardDir, abImportPath);
    return match.replace(importPath, newImportPath);
  });
}




// SCOPED CSS BELOW

function scopeStyles(path, content, body) {
  const $ = cheerio.load(body, {
    withDomLvl1: false,
    normalizeWhitespace: false,
    xmlMode: true,
    decodeEntities: false
  });

  const styles = replaceStyleNames(content, (styleDeclaration) => {
    const { name, style, selectors } = styleDeclaration;
    const newStyleName = `.beard-${hash(path.replace(root, '') + name + style)}`;
    selectors.forEach(selector => {
      if ($(selector)) {
        $(selector).addClass(newStyleName.replace(/^\./, ''));
      }

      // if (!selector.includes('::') && !selector.startsWith('/*') && !selector.startsWith('//') && $(selector)) {
      //   $(selector).addClass(newStyleName.replace(/^\./, ''));
      // }
    });
    return newStyleName;
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
