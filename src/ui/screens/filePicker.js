'use strict';

const path = require('node:path');
const { KEYS } = require('../../state/input');
const { SCREENS } = require('../../state/screens');
const { drawBox } = require('../components/box');
const { drawErrorBanner } = require('../components/errorBanner');
const { ansi } = require('../ansi');
const { listDirectory, filterForPurpose, formatSize } = require('../../io/filePicker');
const { readFile } = require('../../io/readFile');

/**
 * File picker screen.
 *
 * Two modes, driven by state.pickerPurpose:
 *   'encrypt' — all files visible
 *   'decrypt' — only directories + .nth files
 *
 * Key handling is async: pressing Enter on a directory re-lists it; on
 * a file, it reads the buffer and dispatches 'pick'.
 *
 * All side effects go through an `actions` object passed by index.js so
 * the screen itself stays pure-ish (no imports of store or renderer).
 */

const MAX_VISIBLE = 12;   // rows of entries shown at once

function render(screen, state, { cols, rows }) {
    const boxW = Math.min(72, cols - 4);
    const boxH = MAX_VISIBLE + 6;
    const r0 = Math.max(1, Math.floor((rows - boxH) / 2));
    const c0 = Math.max(1, Math.floor((cols - boxW) / 2));

    const title = state.pickerPurpose === 'decrypt'
        ? 'SELECT .NTH FILE'
        : 'SELECT FILE';

    const inner = drawBox(screen, r0, c0, boxW, boxH, {
        title,
        style: ansi.cyan,
        titleStyle: ansi.cyan + ansi.bold,
    });

    // Current directory, truncated from the left if too long.
    const cwdLabel = shortenPath(state.cwd, inner.width);
    screen.text(inner.row, inner.col, cwdLabel, ansi.gray);

    // Separator
    const sepRow = inner.row + 1;
    for (let c = 0; c < inner.width; c++) {
        screen.put(sepRow, inner.col + c, '─', ansi.gray);
    }

    // Entries
    const entries = state.pickerEntries;
    const listTop = inner.row + 2;
    const listH = MAX_VISIBLE;

    if (entries.length === 0) {
        screen.text(listTop, inner.col, '(empty)', ansi.gray);
    }

    // Scroll window: keep the selected entry visible.
    const sel = state.pickerIndex;
    let first = 0;
    if (sel >= MAX_VISIBLE) first = sel - MAX_VISIBLE + 1;
    const visible = entries.slice(first, first + MAX_VISIBLE);

    for (let i = 0; i < visible.length; i++) {
        const realIndex = first + i;
        const e = visible[i];
        const selected = realIndex === sel;
        const row = listTop + i;

        const marker = selected ? '▶ ' : '  ';
        const style = selected
            ? ansi.cyan + ansi.bold
            : (e.isDir ? ansi.blue : ansi.white);

        const sizeLabel = e.isDir ? '' : `  ${formatSize(e.size)}`;
        const nameMax = inner.width - marker.length - sizeLabel.length - 2;
        const name = truncateMiddle(e.name, nameMax);

        screen.text(row, inner.col, marker + name, style);
        if (sizeLabel && !selected) {
            screen.text(row, inner.col + inner.width - sizeLabel.length, sizeLabel, ansi.gray);
        }
        drawErrorBanner(screen, state, { cols, rows });
    }

    // Scroll indicator, if there are more entries than fit
    if (entries.length > MAX_VISIBLE) {
        const pct = Math.round((sel / Math.max(1, entries.length - 1)) * 100);
        const label = ` ${sel + 1}/${entries.length} (${pct}%) `;
        screen.text(r0 + boxH - 2, c0 + boxW - label.length - 2, label, ansi.gray);
    }

    // Footer
    const footer = state.pickerPurpose === 'decrypt'
        ? '↑↓ move   Enter open/pick   Backspace up   Esc cancel'
        : '↑↓ move   Enter open/pick   Backspace up   Esc cancel';
    screen.text(r0 + boxH - 2, c0 + 2, footer, ansi.gray);
}

/**
 * Pure-ish key handler. Returns an intent object that index.js applies.
 *
 * Because some actions are async (listing a directory, reading a file),
 * we return { type: 'async', run: asyncFn } and let index.js await it.
 * This keeps the screen free of direct store/terminal access while
 * still letting Enter trigger I/O.
 */
function handleKey(key, ch, state, actions) {
    const entries = state.pickerEntries;

    switch (key) {
        case KEYS.UP:
            if (entries.length === 0) return null;
            return {
                type: 'set',
                patch: { pickerIndex: (state.pickerIndex - 1 + entries.length) % entries.length },
            };

        case KEYS.DOWN:
            if (entries.length === 0) return null;
            return {
                type: 'set',
                patch: { pickerIndex: (state.pickerIndex + 1) % entries.length },
            };

        case KEYS.ENTER: {
            if (entries.length === 0) return null;
            const chosen = entries[state.pickerIndex];
            if (!chosen) return null;

            if (chosen.isDir) {
                return { type: 'async', run: () => changeDirectory(chosen.path, state, actions) };
            }
            return { type: 'async', run: () => pickFile(chosen, state, actions) };
        }

        case KEYS.BACKSPACE: {
            const parent = path.dirname(state.cwd);
            if (parent === state.cwd) return null;  // already at root
            return { type: 'async', run: () => changeDirectory(parent, state, actions) };
        }

        case KEYS.ESCAPE:
            return { type: 'transition', name: 'back' };

        default:
            return null;
    }
}

async function changeDirectory(dirPath, state, actions) {
    try {
        const all = await listDirectory(dirPath);
        const filtered = filterForPurpose(all, state.pickerPurpose);
        actions.set({
            cwd: dirPath,
            pickerEntries: filtered,
            pickerIndex: 0,
        });
    } catch (err) {
        actions.set({ error: err.message });
        // Show the error but stay on this screen; the footer will pick it up
        // once we add an error banner. For now, we just avoid crashing.
    }
}

async function pickFile(entry, state, actions) {
    if (state.pickerPurpose === 'decrypt') {
        // Decrypt mode: read the .nth file, auto-detect everything, go to pipeline.
        try {
            const file = await readFile(entry.path);
            actions.set({
                filePath: entry.path,
                fileBuffer: file.buffer,
                fileSize: file.size,
            });
            // index.js will then dispatch the 'pick' transition, which for
            // decrypt purpose goes straight to pipeline.
            return { transition: 'pick' };
        } catch (err) {
            actions.set({ error: err.message });
            return null;
        }
    } else {
        // Encrypt mode: read the file, remember it, go pick an algorithm.
        try {
            const file = await readFile(entry.path);
            actions.set({
                filePath: entry.path,
                fileBuffer: file.buffer,
                fileSize: file.size,
            });
            return { transition: 'pick' };
        } catch (err) {
            actions.set({ error: err.message });
            return null;
        }
    }
}

/**
 * Shorten a path so it fits in `width` chars, keeping the tail.
 *   /home/user/Documents/projects → …/Documents/projects
 */
function shortenPath(p, width) {
    if (p.length <= width) return p;
    const ellipsis = '…';
    return ellipsis + p.slice(p.length - (width - ellipsis.length));
}

/**
 * Truncate a name in the middle if it's too long.
 *   very-long-file-name-really.txt → very-long-fil…eally.txt
 */
function truncateMiddle(s, width) {
    if (width <= 3 || s.length <= width) return s;
    const keep = width - 1;
    const front = Math.ceil(keep / 2);
    const back = Math.floor(keep / 2);
    return s.slice(0, front) + '…' + s.slice(s.length - back);
}

module.exports = { render, handleKey, MAX_VISIBLE };