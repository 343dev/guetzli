# @343dev/guetzli

<img align="right" width="64" height="64"
     alt="Guetzli avatar: a round yellow biscuit with a scalloped edge and three red circles"
     src="./logo.svg">

[![NPM Downloads](https://img.shields.io/npm/dw/%40343dev%2Fguetzli)](https://www.npmjs.com/package/@343dev/guetzli)
[![npm](https://img.shields.io/npm/v/@343dev/guetzli.svg)](https://www.npmjs.com/package/@343dev/guetzli)

Google Guetzli v1.0.1 compiled to WebAssembly for Node.js.

Guetzli is a JPEG encoder designed for high visual quality and compression density. This package runs the original C++ encoder in a fresh Worker Thread for each operation. It contains one portable wasm32 build rather than platform-specific executables.

## Requirements

- Node.js 22.22.1 or newer
- ESM
- JPEG input

Version 2.0 does not accept PNG input and has no CommonJS entry point.

## Install

For the JavaScript API:

```sh
npm install @343dev/guetzli
```

For the `guetzli` command:

```sh
npm install --global @343dev/guetzli
```

The package includes the compiled WebAssembly distribution. Installation does not download or compile anything.

## JavaScript API

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

The default export is also available as the named export `encode`:

```js
import { encode, errorCodes } from '@343dev/guetzli';

try {
	const output = await encode(jpegBytes);
} catch (error) {
	if (error.code === errorCodes.MEMORY_LIMIT) {
		// The image does not fit the configured estimate threshold.
	}
}
```

### `encode(input, options?)`

Returns `Promise<Buffer>`.

- `input`: `Buffer` or `Uint8Array`, up to 128 MiB. The selected bytes are copied before `encode()` yields; the caller's buffer is not modified or detached.
- `options.quality`: integer from 84 to 110. Default: 95.
- `options.memlimit`: integer from 100 to 3500 MiB. Default: 3500.

Unknown options are rejected. Explicit `undefined` uses the default. Guetzli metadata removal is always enabled, matching upstream behavior. The encoder returns Guetzli's output even when it is larger than the input.

Errors are ordinary `Error` instances with one stable `code` property:

- `INVALID_INPUT`
- `INVALID_OPTIONS`
- `MEMORY_LIMIT`
- `PROCESSING_FAILED`
- `WASM_OUT_OF_MEMORY`
- `WORKER_FAILED`

Error messages and `cause` are diagnostic and may change between releases.

Each call creates its own Worker and WebAssembly instance. There is no internal concurrency queue. Limit concurrency in the calling application; one operation at a time is recommended for large JPEGs.

## Command line

```text
guetzli [options] <input> <output>
```

Use `-` for standard input or standard output:

```sh
guetzli --quality 95 input.jpg output.jpg
cat input.jpg | guetzli --quality=95 - - > output.jpg
```

Options must precede both operands:

- `--quality Q`: integer from 84 to 110; default 95
- `--memlimit M`: memory estimate limit in MiB from 100 to 3500; default 3500
- `--verbose`: write progress and Guetzli diagnostics to standard error
- `--help`: print usage
- `--version`: print `2.0.0`

File output uses a temporary file in the destination directory, flushes it, preserves an existing regular file's permission bits, and then renames it atomically. Symbolic links and special files are rejected as output targets. Standard output contains only JPEG bytes.

Exit status:

- `0`: success, help, or version
- `1`: invalid input, memory limit, or Guetzli processing failure
- `2`: command usage error
- `3`: filesystem or output-pipe failure
- `4`: Worker or WebAssembly runtime failure
- `130`: SIGINT
- `143`: SIGTERM

## Resource use

Guetzli is deliberately CPU- and memory-intensive. Upstream estimates approximately 300 MiB per megapixel and about one minute of CPU time per megapixel. The WebAssembly build also enforces a wasm32 safety estimate. `memlimit` is a preflight estimate threshold, not a process RSS cap.

Guetzli expects high-quality sRGB JPEG input with gamma 2.2. It ignores embedded color-profile metadata and produces sequential JPEG output. A true single-component grayscale JPEG is not supported by upstream Guetzli; three-component YCbCr JPEGs with grayscale-looking pixels are supported.

See [UPSTREAM.md](UPSTREAM.md) for source and toolchain provenance. Rebuild, memory, parity, and benchmark details are maintained in the repository documentation.

## Other projects

- [optimizt](https://github.com/343dev/optimizt) — image optimization CLI
- [harold](https://github.com/343dev/harold) — bundle-size comparison
- [jailbot](https://github.com/343dev/jailbot) — container wrapper with path mounting
