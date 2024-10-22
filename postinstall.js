#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BINARY_NAME = {
	darwin: 'guetzli_darwin_x86-64',
	linux: 'guetzli_linux_x86-64',
	win32: 'guetzli_windows_x86-64.exe',
};

const binaryName = BINARY_NAME[process.platform];

if (!binaryName) {
	throw new Error(`Platform "${process.platform}" is not supported`);
}

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

await fs.promises.access(path.join(dirname, 'vendor', binaryName));
