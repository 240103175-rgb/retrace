// #146 text from screenshots, entirely in the browser. The engine and the Russian, Kazakh and English models
// are served by this site from /ocr/ (see scripts/ocr-assets.mjs) and loaded only when someone asks for recognition.

export interface OcrJob {
  /** Recognised text, trimmed. */
  result: Promise<string>;
  /** Stops the engine; `result` then rejects with an AbortError. */
  cancel(): void;
}

export const OCR_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

/** @param onProgress 0..1 while the models load and the image is read. */
export function recognizeText(image: Blob, onProgress: (p: number) => void): OcrJob {
  let cancelled = false;
  let stop: () => void = () => {};
  const aborted = () => Object.assign(new Error('cancelled'), { name: 'AbortError' });
  let onCancel: () => void = () => {};
  // Terminating the engine may leave its pending job unsettled, so cancelling rejects on its own.
  const cancelledResult = new Promise<never>((_, reject) => (onCancel = () => reject(aborted())));
  const work = (async () => {
    const { createWorker, OEM } = await import('tesseract.js');
    if (cancelled) throw aborted();
    const base = new URL('/ocr/', window.location.origin).href;
    const worker = await createWorker(['rus', 'kaz', 'eng'], OEM.LSTM_ONLY, {
      workerPath: `${base}worker.min.js`,
      corePath: `${base}core`,
      langPath: `${base}lang`,
      workerBlobURL: false, // a same-origin worker file, so the CSP needs no blob: scripts
      logger: (m) => {
        // Loading the models is the first half of the bar, reading the image the second.
        if (m.status === 'recognizing text') onProgress(0.5 + m.progress / 2);
        else if (m.status.startsWith('load')) onProgress(Math.min(0.5, m.progress / 2));
      },
    });
    stop = () => void worker.terminate();
    if (cancelled) {
      stop();
      throw aborted();
    }
    try {
      const { data } = await worker.recognize(image);
      return data.text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    } catch (err) {
      if (cancelled) throw aborted();
      throw err;
    } finally {
      stop();
    }
  })();
  const result = Promise.race([work, cancelledResult]);
  work.catch(() => {}); // after a cancel nobody awaits `work` any more
  return {
    result,
    cancel() {
      cancelled = true;
      onCancel();
      stop();
    },
  };
}
