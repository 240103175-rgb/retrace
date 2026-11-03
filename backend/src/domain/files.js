// File checks for evidence attachments (#25). Pure JS (no Node APIs): also runs in the browser mock.
import { fail } from './errors.js';

export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_FILES_PER_EVIDENCE = 10;
export const FILE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'text/plain'];

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_INDEX = new Map([...B64].map((c, i) => [c, i]));

/** Strict base64 → bytes; whitespace allowed, anything else is a validation error. */
export function decodeBase64(text) {
  const s = String(text).replace(/\s+/g, '');
  if (!s || s.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(s)) fail('validation_error', 400, 'dataBase64 is not valid base64');
  const pad = s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0;
  const out = new Uint8Array((s.length / 4) * 3 - pad);
  let o = 0;
  for (let i = 0; i < s.length; i += 4) {
    const n = (B64_INDEX.get(s[i]) << 18) | (B64_INDEX.get(s[i + 1]) << 12) | ((B64_INDEX.get(s[i + 2]) ?? 0) << 6) | (B64_INDEX.get(s[i + 3]) ?? 0);
    for (const shift of [16, 8, 0]) if (o < out.length) out[o++] = (n >> shift) & 255;
  }
  return out;
}

const startsWith = (bytes, sig, at = 0) => sig.every((b, i) => bytes[at + i] === b);
const ascii = (str) => [...str].map((c) => c.charCodeAt(0));

/** What the bytes actually are, judged by their signature (magic bytes); null if not an allowed type. */
export function sniffType(bytes) {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, ascii('RIFF')) && startsWith(bytes, ascii('WEBP'), 8)) return 'image/webp';
  if (startsWith(bytes, ascii('%PDF-'))) return 'application/pdf';
  if (!bytes.includes(0)) {
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      return 'text/plain';
    } catch {
      return null;
    }
  }
  return null;
}

/** Keeps the visible name, drops paths and control characters. */
export function cleanFilename(name) {
  const base = String(name ?? '').split(/[\\/]/).pop().replace(/[\u0000-\u001f\u007f"]/g, '').trim();
  if (!base || base === '.' || base === '..') fail('validation_error', 400, 'filename is required');
  return base.slice(0, 200);
}

/** Validates an upload body; returns the decoded bytes and clean metadata. */
export function checkUpload({ filename, mimeType, dataBase64 } = {}) {
  const name = cleanFilename(filename);
  if (!FILE_TYPES.includes(mimeType)) fail('unsupported_file', 415, `mimeType must be one of ${FILE_TYPES.join(', ')}`);
  if (typeof dataBase64 !== 'string') fail('validation_error', 400, 'dataBase64 is required');
  // Reject before decoding when the encoded text alone is already too big.
  if (dataBase64.length > Math.ceil(MAX_FILE_BYTES / 3) * 4 + 1024) fail('file_too_large', 413);
  const bytes = decodeBase64(dataBase64);
  if (bytes.length > MAX_FILE_BYTES) fail('file_too_large', 413);
  const actual = sniffType(bytes);
  // Text is the fallback type, so a declared image/PDF whose bytes look like text is still refused.
  if (actual !== mimeType) fail('unsupported_file', 415, 'file content does not match its type');
  return { filename: name, mimeType, bytes };
}
