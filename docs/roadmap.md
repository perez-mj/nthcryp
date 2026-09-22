# Roadmap

## v0.1 — shipped

- [x] Caesar cipher
- [x] AES-256-GCM
- [x] `.nth` self-describing container format
- [x] Registry with uniform algorithm interface
- [x] Full TUI: main menu, file picker, algorithm picker, parameters, pipeline, result
- [x] Raw-mode keyboard input with terminal cleanup on crash
- [x] Zero dependencies
- [x] `node:test` roundtrip coverage

## v0.2 — more ciphers

Each is ~30 lines plus one registry line:

- [ ] `vigenere` — polyalphabetic substitution with a keyword
- [ ] `xor` — single-byte or repeating-key XOR
- [ ] `chacha20-poly1305` — AEAD, same shape as AES-GCM

## v0.3 — key management

The `requiresPassword` seam becomes real:

- [ ] Password prompt screen (`ui/components/textInput.js`)
- [ ] `scryptSync(pass, salt, 32)` key derivation
- [ ] Salt stored in `.nth` metadata; key never written to disk
- [ ] Backwards-compatible read: files without a salt use embedded-key mode

## v0.4 — asymmetric

Changes the UX (keypair generation, export/import):

- [ ] `rsa` — hybrid encryption (RSA wraps an AES key)
- [ ] `ed25519` — signatures, not encryption
- [ ] "Generate keypair" main-menu item
- [ ] Keyring file format

## Stretch

- [ ] Streaming mode for files larger than memory
- [ ] Progress reporting in bytes for large files
- [ ] Compression before encryption (optional, flagged in metadata)
- [ ] Config file (`~/.nthcryprc`) for defaults
- [ ] Shell completions