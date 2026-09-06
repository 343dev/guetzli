import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import encode, { encode as namedEncode, errorCodes } from '../index.js';

const fixtureUrl = new URL('fixtures/rgb-444.jpg', import.meta.url);
const invalidUrl = new URL('fixtures/invalid.jpg', import.meta.url);
const grayscaleUrl = new URL('fixtures/grayscale-single-component.jpg', import.meta.url);

function sha256(value) {
	return createHash('sha256').update(value).digest('hex');
}

function withDimensions(input, width, height) {
	const copy = Buffer.from(input);
	for (let index = 0; index < copy.length - 9; index += 1) {
		if (copy[index] === 0xFF && [0xC0, 0xC1, 0xC2].includes(copy[index + 1])) {
			copy.writeUInt16BE(height, index + 5);
			copy.writeUInt16BE(width, index + 7);
			return copy;
		}
	}
	throw new Error('Fixture has no JPEG start-of-frame marker');
}

async function expectCode(promise, code) {
	await assert.rejects(promise, (error) => {
		assert.equal(error.code, code);
		return true;
	});
}

test('exports the asynchronous encoder and frozen error codes', async () => {
	assert.equal(namedEncode, encode);
	assert.ok(Object.isFrozen(errorCodes));
	const input = await readFile(fixtureUrl);
	const result = encode(input);
	assert.ok(result instanceof Promise);
	assert.equal(
		sha256(await result),
		'6ee6d159d37d69b7d5071b2f81b3c69d16999b8a85ec1aea40f96003e02833eb',
	);
});

test('snapshots the selected Uint8Array bytes without modifying the input', async () => {
	const fixture = await readFile(fixtureUrl);
	const storage = Buffer.concat([Buffer.from('before'), fixture, Buffer.from('after')]);
	const view = new Uint8Array(storage.buffer, storage.byteOffset + 6, fixture.length);
	const promise = encode(view, Object.create(null));
	view.fill(0);
	const output = await promise;

	assert.equal(
		sha256(output),
		'6ee6d159d37d69b7d5071b2f81b3c69d16999b8a85ec1aea40f96003e02833eb',
	);
	assert.equal(storage.subarray(0, 6).toString(), 'before');
	assert.equal(storage.subarray(-5).toString(), 'after');
	assert.notEqual(output.buffer, view.buffer);
});

test('validates input and options with stable error codes', async () => {
	const fixture = await readFile(fixtureUrl);
	await expectCode(encode('jpeg'), errorCodes.INVALID_INPUT);
	await expectCode(encode(new Uint8Array()), errorCodes.INVALID_INPUT);
	await expectCode(encode(fixture, 1), errorCodes.INVALID_OPTIONS);
	await expectCode(encode(fixture, { quality: 83 }), errorCodes.INVALID_OPTIONS);
	await expectCode(encode(fixture, { quality: 95.5 }), errorCodes.INVALID_OPTIONS);
	await expectCode(encode(fixture, { memlimit: 99 }), errorCodes.INVALID_OPTIONS);
	await expectCode(encode(fixture, { unknown: true }), errorCodes.INVALID_OPTIONS);

	await encode(fixture, { quality: undefined, memlimit: undefined });
});

test('classifies malformed and unsupported JPEG input', async () => {
	await expectCode(encode(await readFile(invalidUrl)), errorCodes.INVALID_INPUT);
	await expectCode(encode(await readFile(grayscaleUrl)), errorCodes.INVALID_INPUT);
});

test('rejects images that exceed either memory estimate', async () => {
	const fixture = await readFile(fixtureUrl);
	await expectCode(
		encode(withDimensions(fixture, 2000, 2000), { memlimit: 100 }),
		errorCodes.MEMORY_LIMIT,
	);
	await expectCode(
		encode(withDimensions(fixture, 4000, 3000)),
		errorCodes.MEMORY_LIMIT,
	);
});

test('supports two concurrent encoding operations', async () => {
	const input = await readFile(fixtureUrl);
	const [quality84, quality90] = await Promise.all([
		encode(input, { quality: 84 }),
		encode(input, { quality: 90 }),
	]);
	assert.equal(sha256(quality84), '27e37f8bbf9c204efa078678b42111fa9f39cf70faaae86f43d1217a87e7c363');
	assert.equal(sha256(quality90), '4f9c06b28471a63e224b025cbfdc8af1ad284644e45df16140fbcd438fb85072');
});
