// #146 text from screenshots: recognition (mocked here, real in e2e/tests/31-ocr.spec.ts) fills a new
// evidence draft for review; nothing is saved automatically; cancel and errors are shown; images only.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { createMockService, DEMO_PASSWORD } from '../services/mockService';

const ocr = vi.hoisted(() => ({ result: Promise.resolve(''), cancel: vi.fn() }));
vi.mock('../lib/ocr', () => ({ OCR_TYPES: ['image/png', 'image/jpeg', 'image/webp'], recognizeText: vi.fn((_blob: Blob, progress: (p: number) => void) => (progress(0.4), ocr)) }));

async function setup() {
  const api = createMockService({ latency: 0 });
  render(
    <MemoryRouter initialEntries={['/login?next=/cases']}>
      <App api={api} mock router={false} />
    </MemoryRouter>,
  );
  await userEvent.type(await screen.findByLabelText('Email'), 'aigerim@retrace.test');
  await userEvent.type(screen.getByLabelText('Пароль'), DEMO_PASSWORD);
  await userEvent.click(screen.getByRole('button', { name: 'Войти' }));
  await userEvent.click(await screen.findByText(/OLX/));
  await userEvent.click(await screen.findByRole('tab', { name: /Доказательства/ }));
  await waitFor(() => expect(screen.getAllByTestId('evidence-row').length).toBeGreaterThan(0));
  const row = within(screen.getAllByTestId('evidence-row')[0]);
  await userEvent.upload(row.getByLabelText('Прикрепить файл'), new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])], 'chat.png', { type: 'image/png' }));
  await row.findByText('chat.png');
  await userEvent.upload(row.getByLabelText('Прикрепить файл'), new File(['txt'], 'note.txt', { type: 'text/plain' }));
  await row.findByText('note.txt');
  return { api, row };
}

beforeEach(() => {
  localStorage.clear();
  Element.prototype.scrollIntoView = vi.fn();
  window.scrollTo = vi.fn();
  ocr.cancel.mockReset();
});

describe('#146 text from screenshots', () => {
  it('offers recognition only for images and opens the recognised text in the form without saving', async () => {
    const { api, row } = await setup();
    const create = vi.spyOn(api, 'createEvidence');
    expect(row.getAllByRole('button', { name: /^Распознать текст/ })).toHaveLength(1);
    ocr.result = Promise.resolve('Переведите 15 000 ₸ на карту\nсрочно');
    await userEvent.click(row.getByRole('button', { name: 'Распознать текст: chat.png' }));
    const content = await screen.findByLabelText(/Содержание|Текст/);
    expect(content).toHaveValue('Переведите 15 000 ₸ на карту\nсрочно');
    expect(screen.getByDisplayValue('Скриншот «chat.png» (распознано)')).toBeInTheDocument();
    expect(await screen.findByText(/Проверьте и исправьте/)).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it('shows progress and can be cancelled', async () => {
    const { row } = await setup();
    ocr.result = new Promise(() => {});
    await userEvent.click(row.getByRole('button', { name: 'Распознать текст: chat.png' }));
    expect(await row.findByText('Распознаём текст… 40%')).toBeInTheDocument();
    await userEvent.click(row.getByRole('button', { name: 'Отменить' }));
    expect(ocr.cancel).toHaveBeenCalled();
  });

  it('reports an image without text and a failure', async () => {
    const { row } = await setup();
    ocr.result = Promise.resolve('');
    await userEvent.click(row.getByRole('button', { name: 'Распознать текст: chat.png' }));
    expect(await screen.findByText('Текст на изображении не найден')).toBeInTheDocument();
    ocr.result = Promise.reject(new Error('wasm'));
    ocr.result.catch(() => {}); // handled by the component; this only silences the early-rejection warning
    await userEvent.click(await row.findByRole('button', { name: 'Распознать текст: chat.png' }));
    expect(await screen.findByText('Не удалось распознать текст')).toBeInTheDocument();
  });
});
