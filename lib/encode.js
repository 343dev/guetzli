import { Worker } from 'node:worker_threads';

import { createError, errorCodes, outOfMemoryPattern } from './errors.js';
import { normalizeOptions } from './options.js';

export const maximumInputSize = 128 * 1024 * 1024;

const workerUrl = new URL('worker.js', import.meta.url);

function snapshotInput(input) {
	if (!(input instanceof Uint8Array)) {
		throw createError(
			errorCodes.INVALID_INPUT,
			'input must be a Buffer or Uint8Array',
		);
	}
	if (input.byteLength === 0) {
		throw createError(errorCodes.INVALID_INPUT, 'JPEG input is empty');
	}
	if (input.byteLength > maximumInputSize) {
		throw createError(
			errorCodes.INVALID_INPUT,
			`JPEG input exceeds the ${maximumInputSize}-byte limit`,
		);
	}
	return Uint8Array.from(input);
}

function deserializeError(serialized) {
	const code = Object.values(errorCodes).includes(serialized?.code)
		? serialized.code
		: errorCodes.WORKER_FAILED;
	const details = serialized?.details?.trim();
	const cause = details ? new Error(details) : undefined;
	return createError(code, serialized?.message || 'Guetzli Worker failed', cause);
}

function classifyWorkerFailure(error) {
	const text = `${error?.code ?? ''} ${error?.message ?? ''}`;
	const code = outOfMemoryPattern.test(text)
		? errorCodes.WASM_OUT_OF_MEMORY
		: errorCodes.WORKER_FAILED;
	const message = code === errorCodes.WASM_OUT_OF_MEMORY
		? 'WebAssembly ran out of memory while encoding the JPEG'
		: 'Guetzli Worker failed';
	return createError(code, message, error);
}

function createOperation(input, options, verbose) {
	const snapshot = snapshotInput(input);
	const normalizedOptions = normalizeOptions(options);
	let worker;
	let settled = false;
	let receivedTermination = false;
	let message;
	let workerError;

	const promise = new Promise((resolve, reject) => {
		try {
			worker = new Worker(workerUrl, {
				execArgv: [],
				name: 'guetzli-encode',
				workerData: {
					input: snapshot.buffer,
					quality: normalizedOptions.quality,
					memlimit: normalizedOptions.memlimit,
					verbose,
				},
				transferList: [snapshot.buffer],
			});
		} catch (error) {
			reject(classifyWorkerFailure(error));
			return;
		}

		worker.once('message', (value) => {
			message = value;
		});
		worker.once('error', (error) => {
			workerError = error;
		});
		worker.once('exit', (exitCode) => {
			settled = true;
			if (receivedTermination) {
				reject(createError(errorCodes.WORKER_FAILED, 'Guetzli Worker was terminated'));
				return;
			}
			if (workerError) {
				reject(classifyWorkerFailure(workerError));
				return;
			}
			if (!message) {
				reject(createError(
					errorCodes.WORKER_FAILED,
					`Guetzli Worker exited without a result (exit code ${exitCode})`,
				));
				return;
			}
			if (!message.ok) {
				reject(deserializeError(message.error));
				return;
			}
			resolve({ output: Buffer.from(message.output), debug: message.debug });
		});
	});

	return {
		promise,
		terminate: async () => {
			if (worker && !settled) {
				receivedTermination = true;
				await worker.terminate();
			}
		},
	};
}

export async function encode(input, options) {
	return createOperation(input, options, false).promise.then(({ output }) => output);
}

export function encodeWithDiagnostics(input, options) {
	return createOperation(input, options, true);
}
