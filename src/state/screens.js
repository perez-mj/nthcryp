'use strict';

/**
 * Screen enum + transition table.
 *
 * Every screen is a string. Every transition is a named edge. The
 * reducer in store.js consults this table; no screen hard-codes its
 * own successor.
 *
 * Add a screen by adding a name here and one row to TRANSITIONS.
 */

const SCREENS = {
  MAIN_MENU:         'mainMenu',
  FILE_PICKER:       'filePicker',
  ALGORITHM_PICKER:  'algorithmPicker',
  PARAMETERS:        'parameters',
  PIPELINE:          'pipeline',
  RESULT:            'result',
  QUIT:              'quit',
};

/**
 * From a given screen, which transitions are legal?
 * Used for documentation and (optionally) validation.
 *
 * The reducer treats these as advisory — the actual dispatch is in
 * the screen handlers. Keeping the table here is what lets us draw the
 * state diagram in one place for the presentation.
 */
const TRANSITIONS = {
  [SCREENS.MAIN_MENU]:        ['selectEncrypt', 'selectDecrypt', 'selectQuit'],
  [SCREENS.FILE_PICKER]:      ['pick', 'back'],
  [SCREENS.ALGORITHM_PICKER]: ['pick', 'back'],
  [SCREENS.PARAMETERS]:       ['done', 'back'],
  [SCREENS.PIPELINE]:         ['done', 'fail'],
  [SCREENS.RESULT]:           ['back'],
  [SCREENS.QUIT]:             [],
};

module.exports = { SCREENS, TRANSITIONS };