#!/usr/bin/env node

import { spawn } from 'node:child_process';

import guetzli from './index.js';

const programArguments = process.argv.slice(2);

spawn(guetzli, programArguments, { stdio: 'inherit' })
	.on('exit', process.exit);
