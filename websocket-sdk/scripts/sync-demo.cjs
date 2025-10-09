#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const examplesDistDir = path.resolve(projectRoot, '..', 'examples', 'websocket-sdk', 'dist');

function ensureDistFilesExist() {
  const entry = path.join(distDir, 'index.js');
  if (!fs.existsSync(entry)) {
    console.error('[sync-demo] Missing dist/index.js. Did you run "npm run build"?');
    process.exit(1);
  }
}

function writeWithShim(src, dest) {
  const original = fs.readFileSync(src, 'utf8');
  const shimmed = [
    'var exports = {};',
    'var module = { exports: exports };',
    original,
    '(function(ex){',
    '  if (typeof window !== "undefined") {',
    '    if (ex.CustomerServiceSDK) {',
    '      window.CustomerServiceSDK = ex.CustomerServiceSDK;',
    '    }',
    '    if (ex.createCustomerServiceSDK) {',
    '      window.createCustomerServiceSDK = ex.createCustomerServiceSDK;',
    '    }',
    '  }',
    '})(module.exports || exports);'
  ].join('\n');
  fs.writeFileSync(dest, shimmed, 'utf8');
}

function copyFile(src, dest, options = {}) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (options.browserShim) {
    writeWithShim(src, dest);
  } else {
    fs.copyFileSync(src, dest);
  }
  console.log(`[sync-demo] Copied ${path.relative(projectRoot, src)} -> ${path.relative(path.resolve(projectRoot, '..'), dest)}`);
}

function run() {
  ensureDistFilesExist();

  const filesToCopy = [
    { name: 'index.js', options: { browserShim: true } },
    { name: 'index.js.map' },
    { name: 'index.d.ts' }
  ];
  filesToCopy.forEach((file) => {
    const fileName = typeof file === 'string' ? file : file.name;
    const options = typeof file === 'string' ? {} : (file.options || {});
    const sourcePath = path.join(distDir, fileName);
    if (!fs.existsSync(sourcePath)) {
      return;
    }
    const targetPath = path.join(examplesDistDir, fileName);
    copyFile(sourcePath, targetPath, options);
  });
}

run();
