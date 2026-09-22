#!/usr/bin/env node
'use strict';

require('../src/index').main().catch((err) => {
  // Something failed before the TUI took over. Print a plain error.
  // Ensure we're out of the alt screen buffer first, in case we got
  // partway in.
  process.stdout.write('\x1b[?1049l\x1b[?25h');
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});