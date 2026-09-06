import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmod, lstat, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { guetzliVersion } from '../lib/version.js';

const cliPath = fileURLToPath(new URL('../cli.js', import.meta.url));
const fixturePath = fileURLToPath(new URL('fixtures/rgb-444.jpg', import.meta.url));
const invalidPath = fileURLToPath(new URL('fixtures/invalid.jpg', import.meta.url));

async function run(arguments_, options = {}) {
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, [cliPath, ...arguments_]);
		const stdout = [];
		const stderr = [];
		child.stdout.on('data', chunk => stdout.push(chunk));
		child.stderr.on('data', chunk => stderr.push(chunk));
		child.once('error', reject);
		child.once('close', status => resolve({
			status,
			stdout: Buffer.concat(stdout),
			stderr: Buffer.concat(stderr),
		}));
		child.stdin.end(options.input);
	});
}

function sha256(value) {
	return createHash('sha256').update(value).digest('hex');
}

test('prints help and version', async () => {
	const help = await run(['--help']);
	assert.equal(help.status, 0);
	assert.match(help.stdout.toString(), /Usage:\n {2}guetzli/);
	assert.match(help.stdout.toString(), /--version\s+Print the Guetzli version/);
	const version = await run(['--version']);
	assert.equal(version.status, 0);
	assert.equal(version.stdout.toString(), `${guetzliVersion}\n`);
});

test('uses strict option parsing and usage exit code 2', async () => {
	for (const arguments_ of [
		[],
		['--unknown'],
		['--quality', '83', 'input', 'output'],
		['--quality', '95', '--quality', '96', 'input', 'output'],
		['input', '--quality', '95', 'output'],
		['--version', 'output'],
	]) {
		const result = await run(arguments_);
		assert.equal(result.status, 2, arguments_.join(' '));
		assert.match(result.stderr.toString(), /guetzli --help/);
	}
});

test('supports file and standard stream operands', async () => {
	const directory = await mkdtemp(path.join(tmpdir(), 'guetzli-cli-'));
	const outputPath = path.join(directory, 'output.jpg');
	const fileResult = await run(['--quality=95', fixturePath, outputPath]);
	assert.equal(fileResult.status, 0);
	assert.equal(sha256(await readFile(outputPath)), '6ee6d159d37d69b7d5071b2f81b3c69d16999b8a85ec1aea40f96003e02833eb');

	const input = await readFile(fixturePath);
	const streamResult = await run(['--quality', '95', '-', '-'], { input });
	assert.equal(streamResult.status, 0);
	assert.equal(sha256(streamResult.stdout), '6ee6d159d37d69b7d5071b2f81b3c69d16999b8a85ec1aea40f96003e02833eb');
	assert.equal(streamResult.stderr.length, 0);
});

test('keeps an existing output intact after encoding failure', async () => {
	const directory = await mkdtemp(path.join(tmpdir(), 'guetzli-atomic-'));
	const outputPath = path.join(directory, 'output.jpg');
	await writeFile(outputPath, 'existing');
	await chmod(outputPath, 0o600);
	const result = await run([invalidPath, outputPath]);
	assert.equal(result.status, 1);
	const unchangedOutput = await readFile(outputPath);
	assert.equal(unchangedOutput.toString(), 'existing');
	if (process.platform !== 'win32') {
		const statistics = await lstat(outputPath);
		assert.equal(statistics.mode & 0o777, 0o600);
	}
});

test('preserves safe file permissions and rejects invalid output types', async () => {
	const directory = await mkdtemp(path.join(tmpdir(), 'guetzli-output-'));
	const outputPath = path.join(directory, 'output.jpg');
	await writeFile(outputPath, 'existing');
	await chmod(outputPath, 0o640);
	const success = await run([fixturePath, outputPath]);
	assert.equal(success.status, 0);
	if (process.platform !== 'win32') {
		const statistics = await lstat(outputPath);
		assert.equal(statistics.mode & 0o777, 0o640);
	}

	const linkPath = path.join(directory, 'link.jpg');
	await symlink(outputPath, linkPath);
	const rejected = await run([fixturePath, linkPath]);
	assert.equal(rejected.status, 3);
	assert.match(rejected.stderr.toString(), /Symbolic links and special files/);

	const rejectedDirectory = await run([fixturePath, directory]);
	assert.equal(rejectedDirectory.status, 3);
	assert.match(rejectedDirectory.stderr.toString(), /Output path is a directory/);
});

test('writes verbose diagnostics only to standard error', async () => {
	const directory = await mkdtemp(path.join(tmpdir(), 'guetzli-verbose-'));
	const result = await run(['--verbose', fixturePath, path.join(directory, 'output.jpg')]);
	assert.equal(result.status, 0);
	assert.equal(result.stdout.length, 0);
	assert.match(result.stderr.toString(), /^Encoding \d+-byte JPEG/);
	assert.match(result.stderr.toString(), /Original Out/);
});
