import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const root = new URL('../', import.meta.url);
const rootPath = fileURLToPath(root);
const npmCliPath = process.env.npm_execpath;

async function command(file, arguments_, options = {}) {
	return execFileAsync(file, arguments_, {
		encoding: 'utf8',
		env: {
			...process.env,
			npm_config_allow_scripts: '',
		},
		maxBuffer: 16 * 1024 * 1024,
		...options,
	});
}

test('the npm tarball installs and runs without build lifecycle hooks', { timeout: 120_000 }, async () => {
	assert.ok(npmCliPath, 'npm_execpath must be set by the npm test command');
	const staging = await mkdtemp(path.join(tmpdir(), 'guetzli-pack-'));
	const installation = path.join(staging, 'installation');
	const { stdout } = await command(process.execPath, [
		npmCliPath,
		'pack',
		rootPath,
		'--json',
		'--pack-destination',
		staging,
	]);
	const packed = JSON.parse(stdout);
	const [{ filename, files }] = Array.isArray(packed)
		? packed
		: Object.values(packed);
	const names = files.map(file => file.path);

	for (const required of [
		'dist/guetzli.mjs',
		'dist/guetzli.wasm',
		'lib/encode.js',
		'cli.js',
		'index.js',
		'index.d.ts',
		'LICENSE',
		'README.md',
		'UPSTREAM.md',
		'THIRD_PARTY_NOTICES.md',
		'logo.svg',
		'package.json',
	]) {
		assert.ok(names.includes(required), `missing ${required}`);
	}
	for (const forbiddenPrefix of ['upstream/', 'src/', 'scripts/', 'test/', 'docs/']) {
		assert.ok(!names.some(name => name.startsWith(forbiddenPrefix)), forbiddenPrefix);
	}
	assert.ok(!names.includes('CONTEXT.md'));
	assert.ok(!names.includes('CHANGELOG.md'));
	assert.ok(!names.some(name => name.endsWith('.map') || name.endsWith('.debug')));

	await writeFile(path.join(staging, 'package.json'), '{"private":true}');
	await command(process.execPath, [
		npmCliPath,
		'install',
		'--ignore-scripts',
		'--no-audit',
		'--no-fund',
		'--prefix',
		installation,
		path.join(staging, filename),
	]);

	const fixturePath = fileURLToPath(new URL('test/fixtures/rgb-444.jpg', root));
	const smoke = `
		import encode from '@343dev/guetzli';
		import { readFile } from 'node:fs/promises';
		const output = await encode(await readFile(${JSON.stringify(fixturePath)}));
		if (output.length !== 3240) throw new Error('unexpected output');
	`;
	await command(process.execPath, ['--input-type=module', '--eval', smoke], { cwd: installation });

	const packageRoot = path.join(installation, 'node_modules/@343dev/guetzli');
	await assert.rejects(
		command(process.execPath, [
			'--input-type=module',
			'--eval',
			'import \'@343dev/guetzli/lib/encode.js\'',
		], { cwd: installation }),
		error => error.stderr.includes('ERR_PACKAGE_PATH_NOT_EXPORTED'),
	);
	const distributionFiles = await readdir(path.join(packageRoot, 'dist'));
	assert.deepEqual(distributionFiles.toSorted(), ['guetzli.mjs', 'guetzli.wasm']);
	const installedPackageBytes = await readFile(path.join(packageRoot, 'package.json'), 'utf8');
	assert.equal(JSON.parse(installedPackageBytes).scripts?.install, undefined);
});
