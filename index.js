import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BINARY_NAME = {
	darwin: 'guetzli_darwin_x86-64',
	linux: 'guetzli_linux_x86-64',
	win32: 'guetzli_windows_x86-64.exe',
};

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const binaryName = BINARY_NAME[process.platform];
const binaryPath = path.join(dirname, 'vendor', binaryName);

export default binaryPath;
