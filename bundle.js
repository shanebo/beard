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




const exts = '(.beard$)';
const regex = new RegExp('(.beard$)', 'g');


const blockTypes = [
  {
    type: 'ssjs',
    blocks: [],
    tagsRegex: /<script\shandle>(?<block>[\s\S]+?)<\/script>/gmi,
    pathsRegex: /(import|require)[^'"`]+['"`]([\.\/][^'"`]+)['"`]/gmi,
    ext: 'ssjs.js'
  },
  {
    type: 'css',
    bundles: {
      entry: []
    },
    blocks: [],
    tagsRegex: /<style\s*(?<scoped>scoped)?\s*(?:bundle=\"(?<bundleName>.+)\")?>(?<block>[\s\S]+?)<\/style>/gmi,
    pathsRegex: /(@import|url)\s*["'\(]*([^'"\)]+)/gmi,
    importStatement: (path) => `@import './${path}';`,
    ext: 'scss'
  },
  {
    type: 'js',
    bundles: {
      entry: []
    },
    blocks: [],
    tagsRegex: /<script\s*(?:bundle=\"(?<bundleName>.+)\")?>(?<block>[\s\S]+?)<\/script>/gmi,
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
    const { type, ext, tagsRegex, pathsRegex, importStatement } = blockType;

    const blockMatches = [];
    body = body.replace(tagsRegex, function(){
      const args = [...arguments];
      const captures = args[args.length - 1];
      blockMatches.push(captures);
      return '';
    });

    blockMatches.forEach((blockMatch) => {
      let { scoped, bundleName, block } = blockMatch;

      block = fixPaths(path, block, pathsRegex);

      if (type === 'css' && scoped) {
        const scopedCSS = scopeStyles(path, block, body);
        block = scopedCSS.styles;
        body = scopedCSS.body;
      }

      const partialPath = `${basename(path, extname(path))}.${assetHash(block)}.${ext}`;
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


function addScopedCSS(body, styleName, newStyleName) {
  const $ = cheerio.load(body, {
    withDomLvl1: false,
    normalizeWhitespace: false,
    xmlMode: true,
    decodeEntities: false
  });

  if (!styleName.includes('::') && !styleName.startsWith('/*') && !styleName.startsWith('//') && $(styleName)) {
    $(styleName).addClass(newStyleName.replace(/^\./, ''));
  }

  return $.html();
  // return ($.html()).replace('scoped=""', 'scoped');
}


function scopeStyles(path, content, originalBody) {
  let body = originalBody;

  const styles = replaceStyleNames(content, (styleName, style) => {
    const newStyleName = `.beard-${hash(path.replace(root, '') + style)}`;
    body = addScopedCSS(body, styleName, newStyleName);
    return newStyleName;
  });

  return {
    styles,
    body
  }
}



function hash(str) {
  // not doing this at all mignt be faster
  // return str;
  let hash = 5381;
  let i = str.length;
  while (i) hash = (hash * 33) ^ str.charCodeAt(--i);
  return hash >>> 0;
}

const cleanWhitespace = str => str.replace(/\s+/g, ' ').trim();

const assetHash = (content) => md5(content).slice(-8);

function replaceStyleNames(str, callback) {
  matches = XRegExp.matchRecursive(str, '{', '}', 'g', {
    valueNames: ['name', null, 'style', null]
  });

  let styleMatch;
  let mediaMatch;
  let styles = '';

  matches.forEach((match) => {
    if (match.name == 'name') {
      if (match.value.trim().startsWith('@')) {
        mediaMatch = match;
      } else {
        styleMatch = match;
        styleMatch.styleNames = match.value.split(',').map((name) => name.trim());
      }
    } else {
      if (mediaMatch) {
        const mediaStyles = replaceStyleNames(match.value, callback);
        styles += `${mediaMatch.value}{${mediaStyles}}`;
        mediaMatch = null;
      } else {
        const styleNameTable = styleMatch.styleNames.map((styleName) => {
          return [styleName, callback(styleName, `${styleName}{${match.value}}`)];
        });
        let newStyleName = styleMatch.value;
        styleNameTable.forEach((styles) => {
          newStyleName = newStyleName.replace(styles[0], styles[1]);
        });
        styles += `${newStyleName}{${match.value}}`;
        styleMatch = null;
      }
    }
  });

  return styles;
}
