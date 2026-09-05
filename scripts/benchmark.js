import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

import encode from '../index.js';

const qualities = { quality: 95 };

function usage() {
	return 'Usage: node scripts/benchmark.js <1mp.jpg> <4mp.jpg> [8mp.jpg]\n';
}

async function medianOperation(operation) {
	await operation();
	const measurements = [];
	for (let index = 0; index < 3; index += 1) {
		const started = process.hrtime.bigint();
		const result = await operation();
		measurements.push({
			milliseconds: Number(process.hrtime.bigint() - started) / 1e6,
			...result,
		});
	}
	return measurements.toSorted(
		(left, right) => left.milliseconds - right.milliseconds,
	)[1];
}

async function nativeEncode(binary, inputPath, outputPath) {
	await new Promise((resolve, reject) => {
		const child = spawn(binary, ['95', inputPath, outputPath], { stdio: 'ignore' });
		child.once('error', reject);
		child.once('exit', (code) => {
			if (code === 0) {
				resolve();
			} else {
				reject(new Error(`Native reference exited with status ${code}`));
			}
		});
	});
	const outputStatistics = await stat(outputPath);
	return { outputBytes: outputStatistics.size };
}

async function measure(inputPath) {
	const defaultBinary = new URL(
		'../.cache/native-reference/guetzli-native-reference',
		import.meta.url,
	).pathname;
	const binary = process.env.GUETZLI_NATIVE_REFERENCE ?? defaultBinary;
	const directory = await mkdtemp(path.join(tmpdir(), 'guetzli-benchmark-'));
	const nativeOutput = path.join(directory, 'native.jpg');
	try {
		const input = await readFile(inputPath);
		const initialization = await medianOperation(async () => {
			const module = await import(`../dist/guetzli.mjs?benchmark=${Math.random()}`);
			await module.default();
			return {};
		});
		const native = await medianOperation(
			async () => nativeEncode(binary, inputPath, nativeOutput),
		);
		const wasm = await medianOperation(async () => {
			const output = await encode(input, qualities);
			return { outputBytes: output.byteLength };
		});
		return {
			fixture: path.basename(inputPath),
			inputBytes: input.byteLength,
			nativeMilliseconds: native.milliseconds,
			nativeOutputBytes: native.outputBytes,
			wasmMilliseconds: wasm.milliseconds,
			wasmOutputBytes: wasm.outputBytes,
			wasmToNativeRatio: wasm.milliseconds / native.milliseconds,
			wasmInitializationMilliseconds: initialization.milliseconds,
		};
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}

if (process.argv.length < 4 || process.argv.length > 5) {
	process.stderr.write(usage());
	process.exitCode = 2;
} else {
	const results = [];
	for (const inputPath of process.argv.slice(2)) {
		results.push(await measure(inputPath));
	}
	process.stdout.write(`${JSON.stringify({
		node: process.version,
		platform: `${process.platform}-${process.arch}`,
		quality: qualities.quality,
		results,
	}, undefined, '\t')}\n`);
}
