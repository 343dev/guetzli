import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import encode from '../index.js';
import manifest from './parity-manifest.json' with { type: 'json' };

const acceptedEquivalent = {
	fixture: 'floating-point-boundary-444.jpg',
	quality: 95,
	inputSha256: '5a9d67c90a42940b4159e4c99423436af00c4bcb43d03fae09071b31561dba25',
	wasmSize: 2505,
	wasmSha256: 'd785856312e9f92bdc89c85b58c2951fd45ceb6a778ef8b90c62c38dcc211bad',
};

function sha256(value) {
	return createHash('sha256').update(value).digest('hex');
}

for (const [fixture, qualities] of Object.entries(manifest.cases)) {
	test(`matches the native reference for ${fixture}`, async () => {
		const input = await readFile(new URL(`fixtures/${fixture}`, import.meta.url));
		for (const [qualityText, expectation] of Object.entries(qualities)) {
			const quality = Number(qualityText);
			const output = await encode(input, { quality });
			if (expectation.parity === 'byte') {
				assert.equal(output.length, expectation.size, `quality ${quality} size`);
				assert.equal(sha256(output), expectation.sha256, `quality ${quality} hash`);
				continue;
			}

			assert.equal(fixture, acceptedEquivalent.fixture);
			assert.equal(quality, acceptedEquivalent.quality);
			assert.equal(sha256(input), acceptedEquivalent.inputSha256);
			assert.equal(output.length, acceptedEquivalent.wasmSize);
			assert.equal(sha256(output), acceptedEquivalent.wasmSha256);
		}
	});
}
