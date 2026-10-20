// Regression tests for bugs found in the v1.1 manual session (#96): #97-#103.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { plural } from '../lib/format';
import { createMockService, DEMO_PASSWORD } from '../services/mockService';

const AIGERIM = 'aigerim@retrace.test';

function Where() {
  const l = useLocation();
  return <output data-testid="where">{l.pathname + l.search}</output>;
}

function renderApp(path: string, api = createMockService({ latency: 0 })) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App api={api} mock router={false} />
      <Where />
    </MemoryRouter>,
  );
  return api;
}

async function signIn(email = AIGERIM) {
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

describe('v1.1 session bugs', () => {
  it('#97 names the field: confirmed evidence needs a source', async () => {
    const api = renderApp('/login?next=/cases');
    const create = vi.spyOn(api, 'createEvidence');
    await signIn();
    await openCase(/OLX/, 'Доказательства');
    await userEvent.click(await screen.findByRole('button', { name: /Добавить/ }));
    await userEvent.type(screen.getByLabelText('Содержание'), 'Просит код из SMS');
    const form = within(screen.getByLabelText('Содержание').closest('form')!);
    await userEvent.selectOptions(form.getByLabelText('Проверка'), 'confirmed');
    await userEvent.click(form.getByRole('button', { name: 'Сохранить' }));
    expect(await screen.findByText('Для статуса «Подтверждено» укажите источник')).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it('#97 names the field: profile name too short', async () => {
    const api = renderApp('/login?next=/profile');
    const update = vi.spyOn(api, 'updateMe');
    await signIn();
    const name = await screen.findByLabelText('Имя');
    await userEvent.clear(name);
    await userEvent.type(name, '   ');
    await userEvent.click(screen.getAllByRole('button', { name: 'Сохранить' })[0]);
    expect(await screen.findByText('Имя: от 2 до 80 символов')).toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
  });

  it('#98 asks before switching tabs with an unsaved form', async () => {
    renderApp('/login?next=/cases');
    await signIn();
    await openCase(/OLX/, 'Доказательства');
    await userEvent.click(await screen.findByRole('button', { name: /Добавить/ }));
    await userEvent.type(screen.getByLabelText('Содержание'), 'черновик');
    await userEvent.click(screen.getByRole('tab', { name: 'Риск' }));
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Продолжить' }));
    expect(screen.getByLabelText('Содержание')).toHaveValue('черновик');
    expect(screen.getByRole('tab', { name: /Доказательства/ })).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(screen.getByRole('tab', { name: 'Риск' }));
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Отменить изменения' }));
    expect(await screen.findByTestId('risk-view')).toBeInTheDocument();
  });

  it('#98 an untouched form does not ask', async () => {
    renderApp('/login?next=/cases');
    await signIn();
    await openCase(/OLX/, 'Доказательства');
    await userEvent.click(await screen.findByRole('button', { name: /Добавить/ }));
    await userEvent.click(screen.getByRole('tab', { name: 'Риск' }));
    expect(await screen.findByTestId('risk-view')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('#99 sign-out does not carry the previous page to the next user', async () => {
    renderApp('/login?next=/profile');
    await signIn();
    await screen.findByRole('heading', { name: 'Профиль' });
    await userEvent.click(screen.getByRole('button', { name: 'Выйти' }));
    await screen.findByLabelText('Email');
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/login$/);
  });

  it('#99 a deep link while signed out still keeps next', async () => {
    renderApp('/cases/1');
    await screen.findByLabelText('Email');
    expect(screen.getByTestId('where')).toHaveTextContent('/login?next=%2Fcases%2F1');
  });

  it('#100 Russian plural forms', () => {
    const f = ['доказательство', 'доказательства', 'доказательств'] as const;
    const got = [0, 1, 2, 4, 5, 11, 12, 14, 21, 22, 25, 111].map((n) => plural(n, f));
    expect(got).toEqual([f[2], f[0], f[1], f[1], f[2], f[2], f[2], f[2], f[0], f[1], f[2], f[2]]);
  });

  it('#100 case list uses the right form', async () => {
    renderApp('/login?next=/cases');
    await signIn();
    expect(await screen.findByText(/^3 доказательства ·/)).toBeInTheDocument();
    expect(screen.getByText(/^4 доказательства ·/)).toBeInTheDocument();
  });

  it('#101 adding a tag the case already has sends nothing', async () => {
    const api = renderApp('/login?next=/cases');
    await signIn();
    await openCase(/OLX/);
    await userEvent.type(screen.getByLabelText('Добавить тег (Enter)'), 'olx{Enter}');
    expect(await screen.findByText('#olx')).toBeInTheDocument();
    const update = vi.spyOn(api, 'updateCase');
    await userEvent.type(screen.getByLabelText('Добавить тег (Enter)'), ' OLX {Enter}');
    expect(update).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Добавить тег (Enter)')).toHaveValue('');
  });

  it('#102 the header has a profile link that stays visible on phones', async () => {
    renderApp('/login?next=/cases');
    await signIn();
    const link = await screen.findByRole('link', { name: 'Профиль' });
    expect(link).toHaveAttribute('href', '/profile');
    const css = readFileSync('src/styles.css', 'utf8');
    const phone = css.slice(css.indexOf('@media (max-width: 760px)'));
    const cls = link.className.split(' ').find((c) => c.startsWith('who-'))!;
    expect(cls).toBeTruthy();
    expect(phone.slice(0, phone.indexOf('\n}'))).not.toMatch(new RegExp(`\\.${cls}[^{]*\\{[^}]*display:\\s*none`));
  });

  it('#103 the router opts in to the v7 behaviour', () => {
    const src = readFileSync('src/App.tsx', 'utf8');
    expect(src).toMatch(/v7_startTransition:\s*true/);
    expect(src).toMatch(/v7_relativeSplatPath:\s*true/);
  });
});

