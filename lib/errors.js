export const errorCodes = Object.freeze({
	INVALID_INPUT: 'INVALID_INPUT',
	INVALID_OPTIONS: 'INVALID_OPTIONS',
	MEMORY_LIMIT: 'MEMORY_LIMIT',
	PROCESSING_FAILED: 'PROCESSING_FAILED',
	WASM_OUT_OF_MEMORY: 'WASM_OUT_OF_MEMORY',
	WORKER_FAILED: 'WORKER_FAILED',
});

export function createError(code, message, cause) {
	const error = cause === undefined
		? new Error(message)
		: new Error(message, { cause });
	error.code = code;
	return error;
}

export function serializeError(error) {
	return {
		code: error?.code,
		message: error instanceof Error ? error.message : String(error),
	};
}
