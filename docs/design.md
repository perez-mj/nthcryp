# Design & Architecture

## Contents

- [Build decisions](#build-decisions)
- [Core concept](#core-concept)
- [The `.nth` file format](#the-nth-file-format)
- [The pipeline animation](#the-pipeline-animation)
- [User flow](#user-flow)
- [State machine](#state-machine)
- [File handling](#file-handling)
- [Key handling](#key-handling)

---

## Build decisions

| Decision | Choice | Notes |
|---|---|---|
| Module system | **CommonJS** | `require` / `module.exports` everywhere |
| Algorithms (v0.1) | **Caesar + AES-256-GCM** | Registry designed so Vigenère/XOR/ChaCha20/RSA drop in later |
| Key handling | **(a) embedded in `.nth` metadata** | Demo-grade; seam left for password-derived keys later |
| UI | **Full TUI** — boxes, colors, raw mode, render loop | No `readline` shortcuts |
| Runtime | **Node v24.16.0** on **Debian GNU/Linux** | `engines: >=18`; `node:test` available |
| Tests | **`node:test`** (built-in) | No framework install; run with `node --test test/` |
| Dependencies | **Zero** | Nothing to install, nothing to explain |

---

## Core concept

NTHCRYP is built on three ideas:

1. **Uniform algorithm interface** — every cipher, from Caesar to AES, exposes the same contract: `options`, `encrypt`, `decrypt`, `stages`. The UI reads these dynamically.
2. **Buffer-in, Buffer-out** — every crypto function takes and returns raw `Buffer` objects, never strings. This is why the same Caesar cipher can encrypt a text message *or* a `.png`.
3. **Self-describing encrypted files** — the output `.nth` file embeds its own metadata (algorithm ID, key, nonce, auth tag) so decryption auto-detects everything.


---

## The `.nth` file format

Every encrypted file NTHCRYP produces is a **self-describing container**. This is what makes auto-detection on decrypt possible — pick a `.nth` file, and the tool reads its own header to know which algorithm and key material to use.

```text
┌─────────────────────────────────────────────┐
│ MAGIC      "NTHCRYP01"          9 bytes     │
│ ALGO LEN   1 byte (uint8)                   │
│ ALGO ID    e.g. "aes-256-gcm"   ALGO LEN    │
│ META LEN   4 bytes (uint32 BE)              │
│ META       JSON, UTF-8          META LEN    │
│ CIPHERTEXT remaining bytes                  │
└─────────────────────────────────────────────┘
```

**Layout in words:**

- **Magic bytes** — `NTHCRYP01`. First thing the tool checks. Anything else → "not a NTHCRYP file."
- **Algorithm ID length** — 1 byte. All current IDs fit well under 255 chars.
- **Algorithm ID** — length-prefixed UTF-8 string. `"caesar"`, `"aes-256-gcm"`, etc.
- **Metadata length** — 4-byte big-endian integer telling the reader how many bytes of JSON follow.
- **Metadata** — JSON blob. For AES-GCM it holds `{ key, nonce, tag }`; for Caesar it holds `{ shift }`. Whatever the algorithm needs to decrypt.
- **Ciphertext** — the rest of the file. Raw bytes.

**Naming convention:**

```
secret.txt          → encrypts to →  secret.txt.nth
photo.jpg           → encrypts to →  photo.jpg.nth
report.pdf          → encrypts to →  report.pdf.nth
```

The original extension stays so the user knows what's inside. `.nth` is always appended.


---

## The pipeline animation

The pipeline screen is what makes NTHCRYP feel alive. Instead of a frozen terminal during a long AES operation, the user sees:

```
ALGORITHM: AES-256-GCM
FILE:      secret.txt (14,832 bytes)

 ✓ Generate key       [████████████████] 100%
 ✓ Generate nonce     [████████████████] 100%
 ▶ Encrypt           [██████░░░░░░░░░░]  42%
   Auth tag           [░░░░░░░░░░░░░░░░]   0%
   Write output       [░░░░░░░░░░░░░░░░]   0%

 ────────────────────────────────────────────

 key generated: 32 bytes
 nonce generated: a4f2c1e8b9d3
 encrypting block 512 of 1216...
```

## User flow

```
MAIN MENU
  ├─ Encrypt file
  │    → FILE PICKER (browse directories, select a file)
  │    → ALGORITHM PICKER (Caesar / AES-256-GCM)
  │    → [if algo has options] PARAMETERS (shift amount, etc.)
  │    → PIPELINE (animated, real crypto running)
  │    → RESULT (output path, key material, size, hex preview)
  │    → back to MAIN MENU
  │
  ├─ Decrypt file
  │    → FILE PICKER (select a .nth file)
  │    → [auto-detect algorithm from container header]
  │    → PIPELINE (reverse stages)
  │    → RESULT (decrypted path, size, integrity ✓/✗)
  │
  ├─ Generate keypair   (stretch: RSA / Ed25519)
  └─ Quit
```

## State machine

Transitions live in one place so you never get lost:

```
mainMenu            → select → filePickerEncrypt
filePickerEncrypt   → pick   → algorithmPicker
                    → back   → mainMenu
algorithmPicker     → pick   → parameters
                    → back   → filePickerEncrypt
parameters          → done   → pipeline
                    → back   → algorithmPicker
pipeline            → done   → result
                    → fail   → result
result              → back   → mainMenu
```

## File handling

**Always treat files as Buffers.** Never assume text — a `.jpg`, `.pdf`, or `.zip` will break any string-based path. Reading returns `{ path, name, size, buffer }`. Writing takes a path and a buffer.

**Text vs binary detection** exists only for *display* — a small hex preview on the result screen — never for choosing encryption behavior.

**The in-terminal file picker** is the trickiest UI piece. It shows a scrolling list of the current directory:

```
┌─ SELECT FILE ──────────────────────────────┐
│ cwd: /home/user/documents                  │
├────────────────────────────────────────────┤
│   ../                                      │
│   notes/                                   │
│ > secret.txt                               │
│   image.png                                │
│   report.pdf                               │
└────────────────────────────────────────────┘
```

Arrow keys move, Enter enters a directory or picks a file, Backspace goes up. Keep it a clean list — no columns, no colors. This is the screen most likely to have alignment bugs, so simplicity wins.

---

## Key handling

**In this version:** the key is embedded in the `.nth` metadata. For AES-GCM, `meta` holds `{ key, nonce, tag }` as hex strings. For Caesar, `meta` holds `{ shift }`.

This is **demo-grade**, deliberately. It's fine for showing the *mechanics* of encryption, but it is **not how real encryption works**. Anyone who has the `.nth` file has the key.

**How real systems do it:**

- **Passphrase-derived keys.** Store a random salt in the metadata; derive the key with PBKDF2, scrypt, or argon2. The key never touches disk. Attacker must brute-force the passphrase.
- **Public-key exchange.** The recipient's public key encrypts a symmetric key; only the recipient's private key can unwrap it. The sender never needs to share a secret.

The registry exposes `requiresPassword` as the seam for the passphrase upgrade: when true, the UI can prompt for a password before the pipeline runs, and `encrypt` can call `scryptSync(pass, salt, 32)` instead of `crypto.randomBytes(32)`. The salt goes in the metadata; the key never does.