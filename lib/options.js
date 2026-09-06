import { createError, errorCodes } from './errors.js';

export const ranges = Object.freeze({
	quality: Object.freeze([84, 110]),
	memlimit: Object.freeze([100, 3500]),
});

export const defaults = Object.freeze({
	quality: 95,
	memlimit: 3500,
});

function isPlainObject(value) {
	if (typeof value !== 'object' || value === null) {
		return false;
	}
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

function validateInteger(name, value, minimum, maximum) {
	if (!Number.isInteger(value) || value < minimum || value > maximum) {
		throw createError(
			errorCodes.INVALID_OPTIONS,
			`${name} must be an integer between ${minimum} and ${maximum}`,
		);
	}
}

export function normalizeOptions(options) {
	if (options === undefined) {
		return { ...defaults };
	}
	if (!isPlainObject(options)) {
		throw createError(
			errorCodes.INVALID_OPTIONS,
			'options must be a plain object',
		);
	}

	for (const name of Object.keys(options)) {
		if (!(name in defaults)) {
			throw createError(
				errorCodes.INVALID_OPTIONS,
				`Unknown option: ${name}`,
			);
		}
	}

	const quality = options.quality === undefined
		? defaults.quality
		: options.quality;
	const memlimit = options.memlimit === undefined
		? defaults.memlimit
		: options.memlimit;

	validateInteger('quality', quality, ...ranges.quality);
	validateInteger('memlimit', memlimit, ...ranges.memlimit);

	return { quality, memlimit };
}
