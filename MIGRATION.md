# Migrating from 1.x to 2.0

Version 2.0 replaces the platform-specific Guetzli executable wrapper with an asynchronous Node.js API backed by WebAssembly. It also changes several CLI defaults and removes PNG support.

## Requirements

Before upgrading:

- Upgrade to Node.js 22.22.1 or later.
- Use ECMAScript modules (ESM).
- Ensure every input is a JPEG no larger than 128 MiB.
- Remove imports of package subpaths such as `@343dev/guetzli/vendor/...`.

The package no longer contains native executables. Installation does not run a build or download platform-specific files.

## JavaScript API

### Replace the executable path with `encode()`

In 1.x, the default export was the path to a native executable. Applications had to start that executable themselves:

```js
import { spawn } from 'node:child_process';
import guetzli from '@343dev/guetzli';

const child = spawn(guetzli, [
	'--quality', '95',
	'input.jpg',
	'output.jpg',
]);
```

In 2.0, the default export is the asynchronous `encode()` function:

```js
import encode from '@343dev/guetzli';
import { readFile, writeFile } from 'node:fs/promises';

const input = await readFile('input.jpg');
const output = await encode(input, {
	quality: 95,
	memlimit: 3500,
});
await writeFile('output.jpg', output);
```

The named export is equivalent:

```js
import { encode } from '@343dev/guetzli';
```

`encode()` accepts a `Buffer` or `Uint8Array` and resolves to a `Buffer`. It does not read or write files. Each call uses a fresh Worker Thread and WebAssembly instance, and the Worker exits before the returned promise settles.

### Handle errors by code

Version 2.0 exposes stable error codes. Do not depend on error messages or `cause`, because they may change between releases.

```js
import { encode, errorCodes } from '@343dev/guetzli';

try {
	const output = await encode(input);
} catch (error) {
	if (error.code === errorCodes.MEMORY_LIMIT) {
		// Raise memlimit within the supported range or use a smaller image.
	}
	throw error;
}
```

The possible codes are:

- `INVALID_INPUT`
- `INVALID_OPTIONS`
- `MEMORY_LIMIT`
- `PROCESSING_FAILED`
- `WASM_OUT_OF_MEMORY`
- `WORKER_FAILED`

### Limit concurrency in the application

Version 2.0 does not queue encoding operations. Guetzli is CPU- and memory-intensive, so applications should control concurrency themselves. Process one large JPEG at a time unless resource measurements justify a higher limit.

## Command line

The command still accepts an input and output operand:

```sh
guetzli [options] <input> <output>
```

### Update memory-limit options

The default memory limit changed from 6000 MiB to 3500 MiB. The supported range is now 100–3500 MiB.

The `--nomemlimit` option has been removed. Remove it from scripts and choose an explicit limit when the 3500 MiB default is not appropriate:

```sh
guetzli --memlimit 2000 input.jpg output.jpg
```

The memory limit is a threshold checked against Guetzli's estimated memory requirement. It is not a hard cap on process memory.

### Put options before operands

Version 2.0 uses strict option parsing. Put all options before the input and output operands:

```sh
# Correct
guetzli --quality 95 input.jpg output.jpg

# No longer accepted
guetzli input.jpg output.jpg --quality 95
```

Each option may be specified only once. `--help` and `--version` must be used alone.

### Keep standard output binary-safe

Use `-` to read from standard input or write to standard output:

```sh
cat input.jpg | guetzli --quality 95 - - > output.jpg
```

JPEG bytes are the only data written to standard output. `--verbose` progress and diagnostics are written to standard error, so scripts that previously captured verbose output from standard output must be updated.

### Account for exit statuses

Version 2.0 defines these exit statuses:

- `0`: success, help, or version
- `1`: invalid input, memory-limit rejection, or encoding failure
- `2`: command usage error
- `3`: filesystem or output-pipe failure
- `4`: Worker or WebAssembly runtime failure
- `130`: interrupted by SIGINT
- `143`: terminated by SIGTERM

Update scripts that treated every nonzero status as the same kind of failure.

## Input changes

PNG input is no longer supported. Convert PNG files to high-quality sRGB JPEGs before passing them to this package. If the PNG contains transparency, choose and apply the intended background during conversion instead of relying on the previous implicit black background.

Guetzli continues to accept JPEG input only at quality values from 84 to 110. The default quality remains 95.

## Upgrade checklist

- [ ] Run the application on Node.js 22.22.1 or later.
- [ ] Replace executable-path imports and child-process calls with `await encode(...)`.
- [ ] Pass JPEG bytes as a `Buffer` or `Uint8Array`.
- [ ] Handle failures using `error.code` where programmatic recovery is needed.
- [ ] Add application-level concurrency control where multiple encodings can overlap.
- [ ] Remove PNG inputs and `--nomemlimit`.
- [ ] Change memory limits above 3500 MiB.
- [ ] Move CLI options before input and output operands.
- [ ] Read verbose CLI diagnostics from standard error.
- [ ] Update handling for the documented CLI exit statuses.
