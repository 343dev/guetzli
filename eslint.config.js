import config from '@343dev/eslint-config';

export default [
	{
		ignores: [
			'.cache/**',
			'dist/**',
			'upstream/**',
		],
	},
	...config,
];
