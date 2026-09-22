'use strict';

const { ansi } = require('../ansi');

/**
 * Progress bar, as a pure function. No state, no side effects.
 *
 *   drawBar(0.42, 20)  →  "[████████░░░░░░░░░░░░]  42%"
 *   drawBar(1, 20)     →  "[████████████████████] 100%"
 *
 * Width counts the inner bar cells only. The brackets are extra.
 */

const FILLED = '█';
const EMPTY = '░';

function drawBar(ratio, width) {
  const clamped = Math.max(0, Math.min(1, ratio));
  const filled = Math.round(clamped * width);
  const empty = width - filled;
  const pct = Math.round(clamped * 100).toString().padStart(3, ' ');
  return `[${FILLED.repeat(filled)}${EMPTY.repeat(empty)}] ${pct}%`;
}

/**
 * Stage line prefix based on status.
 *   pending  →  "  "
 *   running  →  "▶ "
 *   done     →  "✓ "
 *   error    →  "✗ "
 */
function stageMarker(status) {
  switch (status) {
    case 'running': return '▶';
    case 'done':    return '✓';
    case 'error':   return '✗';
    default:        return ' ';
  }
}

function stageStyle(status) {
  switch (status) {
    case 'running': return ansi.cyan + ansi.bold;
    case 'done':    return ansi.green;
    case 'error':   return ansi.red;
    default:        return ansi.gray;
  }
}

/**
 * Ratio for a single stage: 1 if done, 0 if pending, 0.5 if running.
 * The running stage is drawn at 50% because we don't get byte-level
 * progress from Node's cipher — it's a display choice, not a metric.
 */
function stageRatio(status) {
  if (status === 'done') return 1;
  if (status === 'running') return 0.5;
  return 0;
}

module.exports = { drawBar, stageMarker, stageStyle, stageRatio };