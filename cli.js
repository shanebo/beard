#!/usr/bin/env node

const beard = require('./lib/index');
const path = require('path');

if (process.argv.length != 3) {
  console.log(`Usage: beard <path>`);
  return;
}

const beardDir = path.resolve(`${process.cwd()}/${process.argv[2]}`);

console.log(`Bundling beard assets in ${beardDir}...`)

beard({ root: beardDir, loadHandles: false });