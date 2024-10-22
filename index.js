import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BUILDED_BINARY = 'guetzli';

const PREBUILDED_BINARY = {
	darwin: 'guetzli_darwin_x86-64',
	linux: 'guetzli_linux_x86-64',
	win32: 'guetzli_windows_x86-64.exe',
};

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const binaryName = PREBUILDED_BINARY[process.platform] || BUILDED_BINARY;
const binaryPath = path.join(dirname, 'vendor', binaryName);

export default binaryPath;
