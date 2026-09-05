import { parentPort, workerData } from 'node:worker_threads';

import createModule from '../dist/guetzli.mjs';

if (parentPort === null) {
	throw new Error('The Guetzli runtime must run in a Worker Thread');
}

const statuses = {
	1: 'INVALID_INPUT',
	2: 'MEMORY_LIMIT',
	3: 'PROCESSING_FAILED',
	4: 'INVALID_OPTIONS',
};
const unsupportedInputPattern = /Only YUV color space|Unsupported input JPEG|Unsupported sampling factors|Can't read jpg data/i;
const outOfMemoryPattern = /cannot enlarge memory|out of memory|bad_alloc|\bOOM\b/i;

function postFailure(code, message, diagnostic) {
	parentPort.postMessage({
		ok: false,
		error: { code, message, diagnostic },
	});
}

async function encode() {
	const diagnostics = [];
	const module = await createModule({
		print: line => diagnostics.push(line),
		printErr: line => diagnostics.push(line),
	});

	const input = new Uint8Array(workerData.input);
	const pointer = module._malloc(input.byteLength);
	if (pointer === 0) {
		postFailure(
			'WASM_OUT_OF_MEMORY',
			'WebAssembly could not allocate memory for the JPEG input',
			diagnostics.join('\n'),
		);
		return;
	}

	let status;
	try {
		module.HEAPU8.set(input, pointer);
		status = module._guetzli_encode(
			pointer,
			input.byteLength,
			workerData.quality,
			workerData.memlimit,
			workerData.verbose ? 1 : 0,
		);
	} finally {
		module._free(pointer);
	}

	// Any allocation performed by Guetzli may have grown WebAssembly memory.
	// Access Module.HEAPU8 again instead of retaining an earlier heap view.
	if (status !== 0) {
		const diagnostic = diagnostics.join('\n').trim();
		const bridgeMessage = module.UTF8ToString(module._guetzli_error_message());
		let code = statuses[status] ?? 'PROCESSING_FAILED';
		if (code === 'PROCESSING_FAILED' && unsupportedInputPattern.test(diagnostic)) {
			code = 'INVALID_INPUT';
		}
		module._guetzli_reset();
		postFailure(code, bridgeMessage || 'Guetzli encoding failed', diagnostic);
		return;
	}

	const outputPointer = module._guetzli_output_data();
	const outputSize = module._guetzli_output_size();
	const output = module.HEAPU8.slice(outputPointer, outputPointer + outputSize);
	const debug = workerData.verbose
		? module.UTF8ToString(module._guetzli_debug_output())
		: '';
	module._guetzli_reset();

	parentPort.postMessage(
		{ ok: true, output: output.buffer, debug },
		[output.buffer],
	);
}

try {
	await encode();
} catch (error) {
	const message = error instanceof Error ? error.message : String(error);
	postFailure(
		outOfMemoryPattern.test(message) ? 'WASM_OUT_OF_MEMORY' : 'WORKER_FAILED',
		message,
		'',
	);
}
