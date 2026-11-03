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

describe('#23 entity suggestions', () => {
  it('shows suggestions as hints and adds one only on click', async () => {
    const api = renderApp('/login?next=/cases');
    const create = vi.spyOn(api, 'createEntity');
    await signIn();
    await screen.findByText(/OLX/);
    const olx = (await api.listCases()).find((c) => c.title.includes('OLX'))!;
    await api.createEvidence(olx.id, { type: 'message', content: 'Перезвоните на +7 701 999 88 77 или @olx_help_kz' });
    await openCase(/OLX/, 'Сущности');
    const panel = within(await screen.findByTestId('suggestions'));
    expect(panel.getByText(/Подсказка — проверьте перед добавлением/)).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
    const before = panel.getAllByRole('listitem').length;
    const first = panel.getAllByRole('button', { name: /^Добавить / })[0];
    const label = first.getAttribute('aria-label')!.replace(/^Добавить /, '');
    await userEvent.click(first);
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create.mock.calls[0][1].label).toBe(label);
    await waitFor(() => expect(screen.queryAllByTestId('suggestions').length === 0 || within(screen.getByTestId('suggestions')).getAllByRole('listitem').length === before - 1).toBe(true));
  });
});

describe('#24 draft summary', () => {
  it('renders statements with citations that open the cited evidence', async () => {
    renderApp('/login?next=/cases');
    await signIn();
    await openCase(/вакансия/);
    const s = within(await screen.findByTestId('summary'));
    expect(s.getByText(/^В деле 4 доказательства, \d+ (сущность|сущности|сущностей) и \d+ (связь|связи|связей)\.$/)).toBeInTheDocument();
    expect(s.getByText(/^Индикатор риска — \d+ из 100/)).toBeInTheDocument();
    expect(s.getByText('Это индикатор риска, а не доказательство мошенничества.')).toBeInTheDocument();
    const chip = s.getAllByRole('button', { name: /^Открыть доказательство #/ })[0];
    const id = chip.getAttribute('aria-label')!.split('#')[1];
    await userEvent.click(chip);
    expect(screen.getByRole('tab', { name: /Доказательства/ })).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(document.getElementById(`evidence-${id}`)).toHaveClass('flash'));
  });
});

describe('#26 branded PDF', () => {
  it('report shows its fingerprint and «Скачать PDF» prints under a file name', async () => {
    const api = renderApp('/login?next=/cases');
    await signIn();
    await screen.findByText(/вакансия/);
    const job = (await api.listCases()).find((c) => c.title.includes('вакансия'))!;
    const rep = await api.createReport(job.id);
    const print = vi.spyOn(window, 'print').mockImplementation(() => {
      expect(document.title).toBe(`retrace-case-${job.id}-report-${rep.id}`);
    });
    await userEvent.click(screen.getByText(/вакансия/));
    await userEvent.click(await screen.findByRole('tab', { name: 'Отчёты' }));
    await userEvent.click((await screen.findAllByRole('link', { name: /Открыть|Отчёт/ }))[0]);
    expect((await screen.findByTestId('fingerprint')).textContent).toBe(rep.fingerprint);
    expect(screen.getByText('Сводка')).toBeInTheDocument();
    const before = document.title;
    await userEvent.click(screen.getByRole('button', { name: 'Скачать PDF' }));
    expect(print).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event('afterprint'));
    expect(document.title).toBe(before);
  });

  it('print stylesheet hides the app and numbers the pages', async () => {
    const { readFileSync } = await import('node:fs');
    const css = readFileSync('src/styles.css', 'utf8');
    const print = css.slice(css.indexOf('@media print'));
    expect(print).toMatch(/\.topbar, \.no-print[^{]*\{ display: none !important; \}/);
    expect(css).toMatch(/@page \{[^]*counter\(page\)[^]*counter\(pages\)/);
  });
});

describe('#27 collaborative investigations', () => {
  it('owner shares a case and the viewer sees it read-only', async () => {
    renderApp('/login?next=/cases');
    await signIn();
    await openCase(/OLX/);
    const panel = within(await screen.findByTestId('members'));
    expect(panel.getByText('Дело видно только вам.')).toBeInTheDocument();
    await userEvent.type(panel.getByLabelText('Email следователя'), 'nobody@retrace.test');
    await userEvent.click(panel.getByRole('button', { name: 'Добавить участника' }));
    expect(await panel.findByText('Следователь с таким email не найден')).toBeInTheDocument();
    await userEvent.clear(panel.getByLabelText('Email следователя'));
    await userEvent.type(panel.getByLabelText('Email следователя'), 'daniyar@retrace.test');
    await userEvent.click(panel.getByRole('button', { name: 'Добавить участника' }));
    expect(await panel.findByText('Данияр Сеитов')).toBeInTheDocument();

    // Daniyar signs in on the same mock: viewer first.
    await userEvent.click(screen.getByRole('button', { name: 'Выйти' }));
    await signIn('daniyar@retrace.test');
    expect(await screen.findByText(/Совместное: Айгерим Нурланова \(Наблюдатель\)/)).toBeInTheDocument();
    await openCase(/OLX/, 'Доказательства');
    expect(screen.getByText('Вы наблюдатель: дело можно только просматривать.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^\+ Добавить$/ })).toBeNull();
    expect(screen.queryByLabelText('Статус')).toBeNull();

  });

  it('shows a conflict when someone else saved the same evidence first', async () => {
    const api = renderApp('/login?next=/cases');
    await signIn();
    await openCase(/OLX/, 'Доказательства');
    await waitFor(() => expect(screen.getAllByTestId('evidence-row')).toHaveLength(3));
    const row = screen.getAllByTestId('evidence-row')[0];
    await userEvent.click(within(row).getByRole('button', { name: 'Изменить' }));
    // Another session saves the same item in the meantime.
    const olx = (await api.listCases()).find((c) => c.title.includes('OLX'))!;
    const ev = (await api.listEvidence(olx.id))[0];
    await api.updateEvidence(olx.id, ev.id, { content: 'Чужая правка', version: ev.version });
    const content = screen.getByLabelText('Содержание');
    await userEvent.clear(content);
    await userEvent.type(content, 'Моя правка');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(await screen.findByText(/Запись только что изменил другой участник/)).toBeInTheDocument();
    expect(screen.getByLabelText('Содержание')).toHaveValue('Моя правка');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(screen.queryByLabelText('Содержание')).toBeNull());
    expect((await api.listEvidence(olx.id)).find((x) => x.id === ev.id)!.content).toBe('Моя правка');
  });
});

describe('#133 case filters compose', () => {
  it('two quick changes keep both', async () => {
    const { renderHook, act: hookAct } = await import('@testing-library/react');
    const { useCaseFilters } = await import('../pages/CasesPage');
    const { useLocation } = await import('react-router-dom');
    const { result } = renderHook(() => ({ f: useCaseFilters(), loc: useLocation() }), {
      wrapper: ({ children }) => <MemoryRouter initialEntries={['/cases?q=old']}>{children}</MemoryRouter>,
    });
    hookAct(() => {
      result.current.f.onChange({ q: 'фишинг' });
      result.current.f.onChange({ status: 'open' });
    });
    const p = new URLSearchParams(result.current.loc.search);
    expect([p.get('q'), p.get('status')]).toEqual(['фишинг', 'open']);
  });
});
