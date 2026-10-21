// v1.2: features from the post-MVP backlog (#23-#28), against the mock service.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createHash } from 'node:crypto';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { toBase64 } from '../components/Attachments';
import { createMockService, DEMO_PASSWORD } from '../services/mockService';

function renderApp(path: string, api = createMockService({ latency: 0 })) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App api={api} mock router={false} />
    </MemoryRouter>,
  );
  return api;
}

async function signIn(email = 'aigerim@retrace.test') {
  await userEvent.type(await screen.findByLabelText('Email'), email);
  await userEvent.type(screen.getByLabelText('Пароль'), DEMO_PASSWORD);
  await userEvent.click(screen.getByRole('button', { name: 'Войти' }));
}

async function openCase(title: RegExp, tab?: string) {
  await userEvent.click(await screen.findByText(title));
  await screen.findByRole('tab', { name: /Граф/ });
  if (tab) await userEvent.click(screen.getByRole('tab', { name: new RegExp(tab) }));
}

beforeEach(() => {
  localStorage.clear();
  Element.prototype.scrollIntoView = vi.fn();
});

describe('#25 evidence files', () => {
  it('base64 matches Node for large inputs', () => {
    const bytes = new Uint8Array(100_000).map((_, i) => (i * 31) % 256);
    expect(toBase64(bytes)).toBe(Buffer.from(bytes).toString('base64'));
  });

  it('attaches a file, shows its SHA-256 and refuses a wrong type', async () => {
    const api = renderApp('/login?next=/cases');
    const upload = vi.spyOn(api, 'uploadAttachment');
    await signIn();
    await openCase(/OLX/, 'Доказательства');
    await waitFor(() => expect(screen.getAllByTestId('evidence-row')).toHaveLength(3));
    const row = within(screen.getAllByTestId('evidence-row')[0]);
    const text = 'Скриншот переписки';
    const file = new File([text], 'chat.txt', { type: 'text/plain' });
    await userEvent.upload(row.getByLabelText('Прикрепить файл'), file);
    const hash = createHash('sha256').update(text).digest('hex');
    expect(await row.findByText('chat.txt')).toBeInTheDocument();
    expect(row.getByLabelText(`SHA-256 ${hash}`)).toBeInTheDocument();
    expect(upload.mock.calls[0][2].sha256).toBe(hash);
    await userEvent.upload(row.getByLabelText('Прикрепить файл'), new File(['MZ'], 'virus.exe', { type: 'application/x-msdownload' }), { applyAccept: false });
    expect(await screen.findByText(/Этот тип файла нельзя прикрепить/)).toBeInTheDocument();
    expect(upload).toHaveBeenCalledTimes(1);
  });
});
