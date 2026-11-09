// #146 copies the OCR engine and language models into public/ocr/ so the app serves them itself:
// recognition never sends a screenshot or a request to a third party. Run before `dev` and `build`.
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'ocr');
const pkg = (name) => dirname(require.resolve(`${name}/package.json`));

const files = [
  [join(pkg('tesseract.js'), 'dist', 'worker.min.js'), 'worker.min.js'],
  // LSTM-only cores (the app never uses the legacy engine); the worker picks one by the browser's SIMD support.
  ...['tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js'].map((f) => [join(pkg('tesseract.js-core'), f), join('core', f)]),
  ...['rus', 'kaz', 'eng'].map((l) => [join(pkg(`@tesseract.js-data/${l}`), '4.0.0_best_int', `${l}.traineddata.gz`), join('lang', `${l}.traineddata.gz`)]),
];

for (const [from, to] of files) {
  const target = join(out, to);
  if (existsSync(target) && statSync(target).size === statSync(from).size) continue;
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(from, target);
}
console.log(`OCR assets ready in ${out}`);
