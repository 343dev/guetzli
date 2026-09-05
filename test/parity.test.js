import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import encode from '../index.js';
import manifest from './parity-manifest.json' with { type: 'json' };

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

			assert.equal(expectation.parity, 'equivalent');
			assert.equal(sha256(input), expectation.inputSha256);
			assert.equal(output.length, expectation.wasmSize);
			assert.equal(sha256(output), expectation.wasmSha256);
		}
	});
}
