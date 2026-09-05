#!/usr/bin/env node

import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import {
	lstat,
	open,
	rename,
	stat,
	unlink,
} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import packageData from './package.json' with { type: 'json' };
import { encodeWithDiagnostics, maximumInputSize } from './lib/encode.js';
import { defaults } from './lib/options.js';

const exitCodes = {
	encoding: 1,
	usage: 2,
	filesystem: 3,
	runtime: 4,
	SIGINT: 130,
	SIGTERM: 143,
};
const optionDefinitions = {
	help: 'boolean',
	memlimit: 'value',
	quality: 'value',
	verbose: 'boolean',
	version: 'boolean',
};

let receivedSignal;
let signalCount = 0;
let signalReject;
let cancelCurrentOperation = async () => {};

class CliError extends Error {
	constructor(message, exitCode, cause) {
		super(message, cause === undefined ? undefined : { cause });
		this.exitCode = exitCode;
	}
}

class SignalError extends Error {
	constructor(signal) {
		super(`Interrupted by ${signal}`);
		this.signal = signal;
	}
}

function usageError(message) {
	return new CliError(
		`${message}\nRun "guetzli --help" for usage.`,
		exitCodes.usage,
	);
}

function parseInteger(name, value, minimum, maximum) {
	if (!/^\d+$/.test(value)) {
		throw usageError(`--${name} must be an integer`);
	}
	const number = Number(value);
	if (!Number.isSafeInteger(number) || number < minimum || number > maximum) {
		throw usageError(`--${name} must be between ${minimum} and ${maximum}`);
	}
	return number;
}

function parseArguments(arguments_) {
	const options = {
		quality: defaults.quality,
		memlimit: defaults.memlimit,
		verbose: false,
		help: false,
		version: false,
	};
	const seen = new Set();
	const operands = [];
	let parsingOptions = true;

	for (let index = 0; index < arguments_.length; index += 1) {
		const argument = arguments_[index];
		if (parsingOptions && argument === '--') {
			parsingOptions = false;
			continue;
		}
		if (!parsingOptions || operands.length > 0 || !argument.startsWith('--')) {
			operands.push(argument);
			parsingOptions = false;
			continue;
		}

		const equalsIndex = argument.indexOf('=');
		const name = argument.slice(2, equalsIndex === -1 ? undefined : equalsIndex);
		const definition = optionDefinitions[name];
		if (!definition) {
			throw usageError(`Unknown option: --${name}`);
		}
		if (seen.has(name)) {
			throw usageError(`Option --${name} may only be specified once`);
		}
		seen.add(name);

		if (definition === 'boolean') {
			if (equalsIndex !== -1) {
				throw usageError(`Option --${name} does not take a value`);
			}
			options[name] = true;
			continue;
		}

		let value;
		if (equalsIndex === -1) {
			index += 1;
			value = arguments_[index];
			if (value === undefined || value.startsWith('-')) {
				throw usageError(`Option --${name} requires a value`);
			}
		} else {
			value = argument.slice(equalsIndex + 1);
		}
		if (value.length === 0) {
			throw usageError(`Option --${name} requires a value`);
		}

		options[name] = name === 'quality'
			? parseInteger(name, value, 84, 110)
			: parseInteger(name, value, 100, 3500);
	}

	const informationalCount = Number(options.help) + Number(options.version);
	if (informationalCount > 0) {
		if (informationalCount !== 1 || operands.length > 0 || seen.size !== 1) {
			throw usageError('--help and --version must be used alone');
		}
		return { options, operands };
	}
	if (operands.length !== 2) {
		throw usageError('Expected an input and output operand');
	}
	return { options, operands };
}

function helpText() {
	return `Guetzli JPEG encoder

Usage:
  guetzli [options] <input> <output>
  guetzli [options] - - < input.jpg > output.jpg

Operands:
  input                 JPEG filename, or - for standard input
  output                JPEG filename, or - for standard output

Options:
  --quality Q            JPEG quality from 84 to 110 (default: 95)
  --memlimit M           Memory limit in MiB from 100 to 3500 (default: 3500)
  --verbose              Print Guetzli diagnostics to standard error
  --help                 Print this help
  --version              Print the package version
`;
}

function throwIfSignalled() {
	if (receivedSignal) {
		throw new SignalError(receivedSignal);
	}
}

async function readBounded(stream) {
	const chunks = [];
	let size = 0;
	cancelCurrentOperation = async () => stream.destroy(new SignalError(receivedSignal));
	try {
		for await (const chunk of stream) {
			size += chunk.byteLength;
			if (size > maximumInputSize) {
				throw new CliError(
					`JPEG input exceeds the ${maximumInputSize}-byte limit`,
					exitCodes.encoding,
				);
			}
			chunks.push(chunk);
		}
	} finally {
		cancelCurrentOperation = async () => {};
	}
	throwIfSignalled();
	return Buffer.concat(chunks, size);
}

async function readInput(inputPath) {
	try {
		if (inputPath !== '-') {
			const inputStatistics = await stat(inputPath);
			if (inputStatistics.isFile() && inputStatistics.size > maximumInputSize) {
				throw new CliError(
					`JPEG input exceeds the ${maximumInputSize}-byte limit`,
					exitCodes.encoding,
				);
			}
		}
		return await readBounded(
			inputPath === '-' ? process.stdin : createReadStream(inputPath),
		);
	} catch (error) {
		if (error instanceof CliError || error instanceof SignalError) {
			throw error;
		}
		throw new CliError(`Could not read JPEG input: ${error.message}`, exitCodes.filesystem, error);
	}
}

async function outputStatistics(outputPath) {
	try {
		const statistics = await lstat(outputPath);
		if (!statistics.isFile()) {
			throw new CliError(
				'Symbolic links and special files cannot be used as output',
				exitCodes.filesystem,
			);
		}
		return statistics;
	} catch (error) {
		if (error?.code === 'ENOENT') {
			return;
		}
		throw error;
	}
}

function temporaryPath(outputPath) {
	const directory = path.dirname(outputPath);
	const basename = path.basename(outputPath);
	return path.join(directory, `.${basename}.${process.pid}.${randomUUID()}.tmp`);
}

async function preflightOutput(outputPath) {
	if (outputPath === '-') {
		return;
	}
	try {
		await outputStatistics(outputPath);
		const temporary = temporaryPath(outputPath);
		const handle = await open(temporary, 'wx', 0o600);
		await handle.close();
		await unlink(temporary);
	} catch (error) {
		if (error instanceof CliError) {
			throw error;
		}
		throw new CliError(`Cannot write output: ${error.message}`, exitCodes.filesystem, error);
	}
}

async function writeStandardOutput(output) {
	await new Promise((resolve, reject) => {
		let settled = false;
		const onError = (error) => {
			if (!settled) {
				settled = true;
				reject(error);
			}
		};
		const onComplete = (error) => {
			if (error) {
				onError(error);
			} else if (!settled) {
				settled = true;
				resolve();
			}
		};
		// Keep this listener installed until process shutdown: a pipe can report
		// EPIPE after the write callback has completed.
		process.stdout.on('error', onError);
		process.stdout.write(output, onComplete);
	});
}

async function writeFileAtomically(outputPath, output) {
	const temporary = temporaryPath(outputPath);
	let handle;
	let handleIsOpen = false;
	let renamed = false;
	const cleanUp = async () => {
		if (handleIsOpen) {
			await handle.close().catch(() => {});
			handleIsOpen = false;
		}
		if (!renamed) {
			await unlink(temporary).catch(() => {});
		}
	};
	cancelCurrentOperation = cleanUp;

	try {
		handle = await open(temporary, 'wx', 0o600);
		handleIsOpen = true;
		await handle.writeFile(output);
		await handle.sync();

		const currentOutput = await outputStatistics(outputPath);
		const mode = currentOutput
			? currentOutput.mode & 0o777
			: 0o666 & ~process.umask();
		await handle.chmod(mode);
		await handle.close();
		handleIsOpen = false;
		throwIfSignalled();
		await rename(temporary, outputPath);
		renamed = true;
	} finally {
		await cleanUp();
		cancelCurrentOperation = async () => {};
	}
}

async function writeOutput(outputPath, output) {
	try {
		if (outputPath === '-') {
			cancelCurrentOperation = async () => process.stdout.destroy();
			await writeStandardOutput(output);
			cancelCurrentOperation = async () => {};
			return;
		}
		await writeFileAtomically(outputPath, output);
	} catch (error) {
		if (error instanceof CliError || error instanceof SignalError) {
			throw error;
		}
		throw new CliError(`Could not write JPEG output: ${error.message}`, exitCodes.filesystem, error);
	}
}

function encodingExitCode(error) {
	return ['WASM_OUT_OF_MEMORY', 'WORKER_FAILED'].includes(error?.code)
		? exitCodes.runtime
		: exitCodes.encoding;
}

function handleSignal(signal) {
	signalCount += 1;
	if (signalCount > 1) {
		// The second signal intentionally bypasses asynchronous cleanup.
		// eslint-disable-next-line n/no-process-exit
		process.exit(exitCodes[signal]);
	}
	receivedSignal = signal;
	signalReject?.(new SignalError(signal));
	void cancelCurrentOperation();
}

async function main() {
	const { options, operands } = parseArguments(process.argv.slice(2));
	if (options.help) {
		process.stdout.write(helpText());
		return;
	}
	if (options.version) {
		process.stdout.write(`${packageData.version}\n`);
		return;
	}

	const [inputPath, outputPath] = operands;
	const input = await readInput(inputPath);
	throwIfSignalled();
	await preflightOutput(outputPath);
	throwIfSignalled();

	if (options.verbose) {
		process.stderr.write(
			`Encoding ${input.byteLength}-byte JPEG at quality ${options.quality} with a ${options.memlimit} MiB memory limit…\n`,
		);
	}

	const operation = encodeWithDiagnostics(input, {
		quality: options.quality,
		memlimit: options.memlimit,
	});
	cancelCurrentOperation = operation.terminate;
	const signalPromise = new Promise((resolve, reject) => {
		signalReject = reject;
	});
	let result;
	try {
		result = await Promise.race([operation.promise, signalPromise]);
	} catch (error) {
		if (error instanceof SignalError) {
			throw error;
		}
		throw new CliError(error.message, encodingExitCode(error), error);
	} finally {
		signalReject = undefined;
		cancelCurrentOperation = async () => {};
	}
	throwIfSignalled();

	if (options.verbose && result.debug) {
		process.stderr.write(result.debug);
		if (!result.debug.endsWith('\n')) {
			process.stderr.write('\n');
		}
	}
	await writeOutput(outputPath, result.output);
}

process.on('SIGINT', handleSignal);
process.on('SIGTERM', handleSignal);

try {
	await main();
} catch (error) {
	if (error instanceof SignalError || receivedSignal) {
		process.exitCode = exitCodes[receivedSignal ?? error.signal];
	} else {
		process.stderr.write(`${error.message}\n`);
		if (process.argv.includes('--verbose') && error.cause?.cause?.message) {
			process.stderr.write(`${error.cause.cause.message}\n`);
		}
		process.exitCode = error.exitCode ?? exitCodes.runtime;
	}
}
