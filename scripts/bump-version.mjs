#!/usr/bin/env node
// 升版本号：同步改脚本头 @version、正文 SCRIPT_VERSION 与 package.json。
// 用法：node scripts/bump-version.mjs [patch|minor|major]
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const kinds = ['patch', 'minor', 'major'];
const kind = process.argv[2] || 'patch';
if (!kinds.includes(kind)) {
    console.error(`未知类型 ${kind}，只接受 ${kinds.join(' / ')}`);
    process.exit(1);
}

const scriptPath = path.join(root, 'dvi-chat-plus.user.js');
const pkgPath = path.join(root, 'package.json');
const script = readFileSync(scriptPath, 'utf8');

const current = (script.match(/^\/\/ @version\s+(\S+)$/m) || [])[1];
if (!current) {
    console.error('脚本头里没找到 @version');
    process.exit(1);
}

const parts = current.split('.').map(Number);
if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    console.error(`版本号不是 major.minor.patch 格式：${current}`);
    process.exit(1);
}
if (kind === 'major') parts.splice(0, 3, parts[0] + 1, 0, 0);
else if (kind === 'minor') parts.splice(1, 2, parts[1] + 1, 0);
else parts[2] += 1;
const next = parts.join('.');

const updated = script
    .replace(/^\/\/ @version\s+\S+$/m, `// @version      ${next}`)
    .replace(/SCRIPT_VERSION\s*=\s*'[^']*'/, `SCRIPT_VERSION = '${next}'`);
writeFileSync(scriptPath, updated, 'utf8');

const pkg = readFileSync(pkgPath, 'utf8').replace(/"version":\s*"[^"]*"/, `"version": "${next}"`);
writeFileSync(pkgPath, pkg, 'utf8');

console.log(`${current} -> ${next}（${kind}）`);
console.log('记得在 CHANGELOG.md 顶部补一条。');
