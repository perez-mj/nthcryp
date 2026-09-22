# NTHCRYP

> *The Nth layer of encryption.*

A terminal-based file encryption tool that starts with a Caesar cipher and scales all the way to AES-256-GCM and ChaCha20-Poly1305 — without ever needing a rewrite. Every algorithm plugs into the same interface, so the UI never has to know which one it's running.

[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-blue)](#)
[![Tests](https://img.shields.io/badge/tests-node%3Atest-blueviolet)](#testing)
[![License](https://img.shields.io/badge/license-MIT-lightgrey)](#license)

---

## Features

- **Uniform algorithm interface** — every cipher, from Caesar to AES, exposes the same contract. The UI reads it dynamically and never branches on algorithm name.
- **Buffer-in, Buffer-out** — crypto functions take and return `Buffer`, never `string`. The same Caesar cipher that encrypts a text message also encrypts a `.png`.
- **Self-describing `.nth` files** — the output embeds its own algorithm ID and metadata, so decryption auto-detects everything from the file header.
- **Full TUI** — boxes, colors, raw-mode keyboard input, animated pipeline.
- **Zero dependencies** — nothing to install, nothing to explain.

---

## Quick start

```bash
git clone https://github.com/perez-mj/nthcryp.git
cd nthcryp
node bin/nthcryp.js
```

Or, if you install it globally:

```bash
npm link
nthcryp
```

Requirements: **Node.js ≥ 18** (tested on v24.16.0, Debian GNU/Linux). No `npm install` step — there are no dependencies.

---

## Usage

NTHCRYP is fully interactive. From the main menu:

```
NTHCRYP
──────────────────────────────────
  ▶ Encrypt file
    Decrypt file
    Quit
```

Use arrow keys to move, Enter to select. Esc quits from the main menu.

**Encrypt** walks you through file → algorithm → parameters → pipeline → result.
**Decrypt** asks only for a file — the algorithm is read from the `.nth` header.

---

## The `.nth` format

Every encrypted file is a self-describing container:

```
┌─────────────────────────────────────────────┐
│ MAGIC      "NTHCRYP01"          8 bytes     │
│ ALGO LEN   1 byte (uint8)                   │
│ ALGO ID    e.g. "aes-256-gcm"   ALGO LEN    │
│ META LEN   4 bytes (uint32 BE)              │
│ META       JSON, UTF-8          META LEN    │
│ CIPHERTEXT remaining bytes                  │
└─────────────────────────────────────────────┘
```

Naming convention:

```
secret.txt   → encrypts to → secret.txt.nth
photo.jpg    → encrypts to → photo.jpg.nth
```

---

## Architecture

```
src/
├── ui/         presentation — screen buffer, ANSI, screens
├── state/      store, screen enum, raw-mode input
├── crypto/     algorithms + registry (never imports UI)
├── io/         file read/write, picker, .nth format
└── util/       events, hex, sleep
```

**The one rule that matters:** `src/crypto/**` must never import from `src/ui/**`. If you ever want to `console.log` inside `aes-gcm.js`, that's a signal to emit an event instead. This separation lets you test crypto without a terminal and swap the UI later.

---

## Algorithm registry

Every algorithm exposes the same interface:

| Field | Type | Meaning |
|---|---|---|
| `name` | `string` | Human-readable label (`"AES-256-GCM"`) |
| `id` | `string` | Registry key (`"aes-256-gcm"`) |
| `options` | `array` | User params, each `{ key, label, type, default }` |
| `generatesKey` | `bool` | Does it create its own key? |
| `requiresPassword` | `bool` | Does it need a passphrase? |
| `stages` | `string[]` | Stage names for the pipeline animation |
| `encrypt` | `(input, params, emit?) => { data, meta }` | |
| `decrypt` | `(input, params, meta, emit?) => { data }` | |


**v0.1 ships with:** `caesar`, `aes-256-gcm`.

---

## Testing

No framework, no config — Node's built-in `node:test`:

```bash
node --test
```

---

## Project status

**v0.1 — complete.**  CLI encryptor + full TUI.

Not yet implemented:

- `vigenere` — trivial, one file + one registry line
- `xor` — trivial
- `chacha20-poly1305` — same shape as AES-GCM
- `rsa` / `ed25519` — stretch goal, changes the UX (keypair generation)

See [docs/roadmap.md](docs/roadmap.md).

---

## Documentation

- [Design & architecture](docs/design.md) — folder layout, registry contract, pipeline animation, state machine, `.nth` format details
- [Roadmap](docs/roadmap.md) — what's next

---

## License

MIT — see [LICENSE](LICENSE).