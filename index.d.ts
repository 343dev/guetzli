/// <reference types="node" />

export interface EncodeOptions {
	readonly quality?: number;
	readonly memlimit?: number;
}

export type GuetzliErrorCode =
	| 'INVALID_INPUT'
	| 'INVALID_OPTIONS'
	| 'MEMORY_LIMIT'
	| 'PROCESSING_FAILED'
	| 'WASM_OUT_OF_MEMORY'
	| 'WORKER_FAILED';

export declare const errorCodes: Readonly<{
	INVALID_INPUT: 'INVALID_INPUT';
	INVALID_OPTIONS: 'INVALID_OPTIONS';
	MEMORY_LIMIT: 'MEMORY_LIMIT';
	PROCESSING_FAILED: 'PROCESSING_FAILED';
	WASM_OUT_OF_MEMORY: 'WASM_OUT_OF_MEMORY';
	WORKER_FAILED: 'WORKER_FAILED';
}>;

export declare function encode(
	input: Buffer | Uint8Array,
	options?: EncodeOptions,
): Promise<Buffer>;

export default encode;
