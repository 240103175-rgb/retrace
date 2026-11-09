// v1.4 frontend: language and theme (#156 #158), timeline (#144), matches and similar cases (#136 #148),
// rule settings (#140), discussion (#150), intake and public pages (#152 #154), offline banner (#160).
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { groupByDay } from '../components/Timeline';
import { actionText } from '../pages/AdminPage';
import { DICTIONARIES, MAPS, setLanguage } from '../lib/text';
import { createMockService, DEMO_PASSWORD } from '../services/mockService';
import type { Evidence } from '../services/types';

function renderApp(path: string, api = createMockService({ latency: 0 })) {
  const view = render(
    <MemoryRouter initialEntries={[path]}>
      <App api={api} mock router={false} />
    </MemoryRouter>,
  );
  return { api, view };
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
  document.documentElement.removeAttribute('data-theme');
  setLanguage('ru');
  Element.prototype.scrollIntoView = vi.fn();
});

describe('#156 Kazakh interface', () => {
  it('both dictionaries and all maps have the same keys and no empty texts', () => {
    const ru = Object.keys(DICTIONARIES.ru).sort();
    expect(Object.keys(DICTIONARIES.kk).sort()).toEqual(ru);
    for (const lang of ['ru', 'kk'] as const) for (const [k, v] of Object.entries(DICTIONARIES[lang])) expect(v.trim(), `${lang}.${k}`).not.toBe('');
    for (const name of Object.keys(MAPS.ru) as (keyof typeof MAPS.ru)[]) expect(Object.keys(MAPS.kk[name]).sort(), name).toEqual(Object.keys(MAPS.ru[name]).sort());
    // Placeholders match between languages.
    const holes = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
    for (const k of ru) expect(holes(DICTIONARIES.kk[k as keyof typeof DICTIONARIES.kk]), k).toBe(holes(DICTIONARIES.ru[k as keyof typeof DICTIONARIES.ru]));
  });

  it('components hold no literal Russian or Kazakh text (everything goes through the dictionary)', () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.tsx?$/.test(f)) files.push(p);
      }
    };
    for (const d of ['src/components', 'src/pages']) walk(d);
    files.push('src/App.tsx');
    const offenders = files.flatMap((f) =>
      readFileSync(f, 'utf8')
        .split('\n')
        .map((line, i) => [line, i + 1] as const)
        .filter(([line]) => /[А-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІі]/.test(line.replace(/\/\/.*$|\/\*.*?\*\/|^\s*\*.*$/g, '')))
        .map(([line, n]) => `${f}:${n}: ${line.trim()}`),
    );
    expect(offenders).toEqual([]);
  });

  it('switches to Kazakh, remembers it and sets <html lang>', async () => {
    renderApp('/login?next=/cases');
    await signIn();
    await screen.findAllByTestId('case-row');
    await userEvent.click(screen.getByRole('button', { name: 'Қазақша' }));
    expect(await screen.findByRole('heading', { name: 'Істер' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Жаңа іс/ })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('kk');
    expect(localStorage.getItem('retrace_lang')).toBe('kk');
    expect(screen.getAllByText(/3 дәлел ·/).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: 'Русский' }));
    expect(await screen.findByRole('heading', { name: 'Дела' })).toBeInTheDocument();
  });

  it('audit actions are translated', () => {
    expect(actionText('case.create')).toBe('создал дело');
    expect(actionText('risk.rule.suspicious_link:20>off')).toBe('правило «Подозрительная ссылка»: 20 → выкл.');
    setLanguage('kk');
    expect(actionText('case.create')).toBe('іс құрды');
    expect(actionText('case.status.closed')).toBe('мәртебе → Жабық');
  });
});

describe('#158 theme', () => {
  it('cycles system → light → dark and remembers the choice', async () => {
    renderApp('/login');
    const button = await screen.findByRole('button', { name: 'Тема: Как в системе' });
    await userEvent.click(button);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    await userEvent.click(screen.getByRole('button', { name: 'Тема: Светлая' }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('retrace_theme')).toBe('dark');
    await userEvent.click(screen.getByRole('button', { name: 'Тема: Тёмная' }));
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });
});

describe('#144 timeline', () => {
  const ev = (id: number, observedOn: string | null, type: Evidence['type'] = 'message', amount: number | null = null): Evidence => ({
    id, caseId: 1, type, content: `e${id}`, source: null, observedOn, amount, verification: 'unverified', createdAt: '2026-11-01T00:00:00Z',
  });
  it('groups by day with gaps, undated last, payments with a running total', () => {
    const days = groupByDay([ev(1, '2026-10-20', 'payment', 5000), ev(2, null), ev(3, '2026-10-14'), ev(4, '2026-10-20', 'payment', 7000), ev(5, '2026-10-15')]);
    expect(days.map((d) => [d.key, d.gapDays])).toEqual([['2026-10-14', 0], ['2026-10-15', 1], ['2026-10-20', 5], ['', 0]]);
    expect(days[2].items.map((i) => i.total)).toEqual([5000, 12000]);
  });
  it('is shown on the overview', async () => {
    renderApp('/login?next=/cases');
    await signIn();
    await openCase(/вакансия/);
    const tl = await screen.findByTestId('timeline');
    expect(within(tl).getByText('14.10.2026')).toBeInTheDocument();
    expect(within(tl).getByText(/всего переведено: 15/)).toBeInTheDocument();
  });
});

describe('#136 #148 cross-case', () => {
  it('shows matches on the entities tab and similar cases on the overview', async () => {
    const { api } = renderApp('/login?next=/cases');
    await signIn();
    await screen.findAllByTestId('case-row');
    const cases = await api.listCases();
    const [job, olx] = [cases.find((c) => c.title.includes('вакансия'))!, cases.find((c) => c.title.includes('OLX'))!];
    await api.createEntity(olx.id, { type: 'card', label: '4400 4301 2345 6789' });
    await api.createEntity(job.id, { type: 'card', label: '4400-4301-2345-6789' });
    await openCase(/OLX/, 'Сущности');
    const m = await screen.findByTestId('matches');
    expect(within(m).getByText('4400 4301 2345 6789')).toBeInTheDocument();
    expect(within(m).getByRole('link', { name: job.title })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Обзор' }));
    expect(within(await screen.findByTestId('similar')).getByRole('link', { name: job.title })).toBeInTheDocument();
  });
});

describe('#140 rule settings', () => {
  it('admin switches a rule off', async () => {
    renderApp('/login?next=/admin');
    await signIn('admin@retrace.test');
    const table = await screen.findByTestId('risk-rules');
    const box = within(table).getByLabelText('Включено: Подозрительная ссылка');
    await userEvent.click(box);
    await waitFor(() => expect(within(screen.getByTestId('risk-rules')).getByLabelText('Включено: Подозрительная ссылка')).not.toBeChecked());
    expect(await within(screen.getByTestId('audit')).findByText('правило «Подозрительная ссылка»: 20 → выкл.')).toBeInTheDocument();
  });
});

describe('#150 discussion', () => {
  it('adds a task and a comment and completes the task', async () => {
    renderApp('/login?next=/cases');
    await signIn();
    await openCase(/OLX/, 'Обсуждение');
    await userEvent.type(await screen.findByLabelText('Новая задача'), 'Запрос в банк');
    await userEvent.click(screen.getByRole('button', { name: 'Добавить' }));
    expect(await screen.findByText('Запрос в банк')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Обсуждение/ })).toHaveTextContent('1');
    await userEvent.type(screen.getByLabelText('Написать комментарий'), 'Номер карты совпал');
    await userEvent.click(screen.getByRole('button', { name: 'Отправить' }));
    expect(within(await screen.findByTestId('comments')).getByText('Номер карты совпал')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: /Запрос в банк/ }));
    await waitFor(() => expect(screen.getByRole('tab', { name: /Обсуждение/ })).not.toHaveTextContent('1'));
  });
});

describe('#152 #154 public pages and intake', () => {
  it('a victim reports without an account; an investigator takes it as a case', async () => {
    const { api } = renderApp('/report');
    await userEvent.type(await screen.findByLabelText('Что произошло'), 'Позвонили из «банка», попросили код из SMS и перевести деньги');
    await userEvent.click(screen.getByRole('button', { name: 'Отправить' }));
    expect(await screen.findByText('Нужно согласие на обработку сообщения')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Отправить' }));
    const sent = await screen.findByTestId('report-sent');
    const ref = /RT-[0-9A-F]{8}/.exec(sent.textContent ?? '')![0];
    expect(within(sent).getByText(/Позвоните в свой банк/)).toBeInTheDocument();

    const s = await api.login({ email: 'aigerim@retrace.test', password: DEMO_PASSWORD });
    api.setToken(s.token);
    const [r] = await api.listIntake();
    expect(r.reference).toBe(ref);
  });

  it('intake page takes a report and opens the new case', async () => {
    const { api } = renderApp('/login?next=/intake');
    await api.submitPublicReport({ description: 'Продавец на OLX прислал ссылку для «безопасной сделки»', consent: true });
    await signIn();
    const row = await screen.findByTestId('intake-row');
    await userEvent.click(within(row).getByRole('button', { name: 'Взять в работу' }));
    expect(await screen.findByRole('heading', { name: /Обращение RT-/ })).toBeInTheDocument();
  });

  it('the check page counts investigations and flags look-alike links', async () => {
    renderApp('/check');
    await userEvent.type(await screen.findByLabelText('Телефон, карта, ссылка или @аккаунт'), 'https://kaspl.kz/bonus');
    await userEvent.click(screen.getByRole('button', { name: 'Проверить' }));
    const res = await screen.findByTestId('check-result');
    expect(res).toHaveTextContent('опечатка в известном домене');
    expect(res).toHaveTextContent('подсказка, а не доказательство');
  });
});

describe('#160 offline', () => {
  it('shows the banner when the connection drops', async () => {
    renderApp('/login?next=/cases');
    await signIn();
    await screen.findAllByTestId('case-row');
    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByTestId('offline-banner')).toHaveTextContent('Нет сети');
    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.queryByTestId('offline-banner')).toBeNull();
  });

  it('the service worker never caches writes, auth or public endpoints', () => {
    const sw = readFileSync('public/sw.js', 'utf8');
    expect(sw).toMatch(/request\.method !== 'GET'/);
    expect(sw).toMatch(/\/auth\\\//);
    expect(sw).toMatch(/\/public\\\//);
    expect(sw).toMatch(/type === 'clear'/);
  });
});
