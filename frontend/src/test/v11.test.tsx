// v1.1 group C — frontend features, against the mock service.
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { ErrorBoundary } from '../components/kit';
import { createMockService, DEMO_PASSWORD } from '../services/mockService';

const AIGERIM = 'aigerim@retrace.test';

function renderApp(path: string, api = createMockService({ latency: 0 })) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App api={api} mock router={false} />
    </MemoryRouter>,
  );
  return api;
}

async function signIn(email = AIGERIM, password = DEMO_PASSWORD) {
  await userEvent.type(await screen.findByLabelText('Email'), email);
  await userEvent.type(screen.getByLabelText('Пароль'), password);
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

describe('case page features', () => {
  it('#61 filters evidence by text and type', async () => {
    renderApp('/login?next=/cases');
    await signIn();
    await openCase(/OLX/, 'Доказательства');
    await waitFor(() => expect(screen.getAllByTestId('evidence-row')).toHaveLength(3));
    await userEvent.type(screen.getByLabelText('Поиск в доказательствах'), 'SMS');
    await waitFor(() => expect(screen.getAllByTestId('evidence-row')).toHaveLength(1));
    await userEvent.clear(screen.getByLabelText('Поиск в доказательствах'));
    await userEvent.selectOptions(screen.getByLabelText('Тип'), 'link');
    await waitFor(() => expect(screen.getAllByTestId('evidence-row')).toHaveLength(1));
    await userEvent.type(screen.getByLabelText('Поиск в доказательствах'), 'zzzz');
    expect(await screen.findByText(/Ничего не найдено/)).toBeInTheDocument();
  });

  it('#62 adds a tag on the case and filters the list by it', async () => {
    renderApp('/login?next=/cases');
    await signIn();
    await openCase(/вакансия/);
    await userEvent.type(screen.getByLabelText('Добавить тег (Enter)'), 'Telegram{Enter}');
    expect(await screen.findByText('#telegram')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: /Назад/ }));
    await userEvent.click(await screen.findByRole('button', { name: '#telegram' }));
    await waitFor(() => expect(screen.getAllByTestId('case-row')).toHaveLength(1));
    await userEvent.click(screen.getByRole('button', { name: 'Сбросить фильтр' }));
    await waitFor(() => expect(screen.getAllByTestId('case-row')).toHaveLength(2));
  });

  it('#63 #76 saves notes and counts characters', async () => {
    renderApp('/login?next=/cases');
    await signIn();
    await openCase(/OLX/);
    const notes = screen.getByLabelText('Заметки');
    await userEvent.type(notes, 'Проверить OLX');
    expect(screen.getByText('осталось 4987')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить заметки' }));
    await userEvent.click(await screen.findByRole('tab', { name: /Граф/ }));
    await userEvent.click(screen.getByRole('tab', { name: 'Обзор' }));
    expect(await screen.findByDisplayValue('Проверить OLX')).toBeInTheDocument();
  });

  it('#64 exports JSON and CSV through the service layer', async () => {
    const created: Blob[] = [];
    URL.createObjectURL = (b: Blob) => (created.push(b), 'blob:x');
    URL.revokeObjectURL = () => {};
    const clicks: string[] = [];
    const orig = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      clicks.push(this.download);
    };
    renderApp('/login?next=/cases');
    await signIn();
    await openCase(/вакансия/);
    await userEvent.click(screen.getByRole('button', { name: 'Экспорт JSON' }));
    await userEvent.click(screen.getByRole('button', { name: 'Экспорт CSV' }));
    await waitFor(() => expect(clicks).toHaveLength(2));
    expect(clicks[0]).toMatch(/^retrace-case-\d+\.json$/);
    expect(clicks[1]).toMatch(/^retrace-case-\d+-evidence\.csv$/);
    const text = await new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.readAsText(created[0]);
    });
    expect(JSON.parse(text).format).toBe('retrace-case/1');
    HTMLAnchorElement.prototype.click = orig;
  });

  it('#68 #69 #82 graph legend, focus dimming and text alternative', async () => {
    renderApp('/login?next=/cases');
    await signIn();
    await openCase(/вакансия/, 'Граф');
    const legend = await screen.findByTestId('legend');
    for (const name of ['Аккаунт', 'Ссылка', 'Карта', 'Телефон', 'Человек']) expect(within(legend).getByText(new RegExp(name))).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Карта 4400 43** **** 1207' }));
    const dimmed = document.querySelectorAll('.node.is-dim');
    expect(dimmed.length).toBeGreaterThan(0);
    expect(screen.getByText('Связи текстом')).toBeInTheDocument();
  });

  it('#70 lists the rules that did not trigger', async () => {
    renderApp('/login?next=/cases');
    await signIn();
    await openCase(/OLX/, 'Риск');
    const off = await screen.findByTestId('rules-off');
    expect(within(off).getByText(/Просят установить программу удалённого доступа/)).toBeInTheDocument();
    expect(within(off).queryByText(/Просят код, пароль/)).toBeNull();
  });

  it('#71 report rows show their score', async () => {
    renderApp('/login?next=/cases');
    await signIn();
    await openCase(/вакансия/, 'Отчёты');
    await userEvent.click(screen.getByRole('button', { name: 'Сформировать отчёт' }));
    const row = await screen.findByTestId('report-row');
    expect(within(row).getByText('65')).toBeInTheDocument();
    expect(within(row).getByText(/Высокий/)).toBeInTheDocument();
  });

  it('#72 #80 new case shows a checklist and a toast', async () => {
    renderApp('/login?next=/cases');
    await signIn();
    await userEvent.click(await screen.findByRole('button', { name: /Новое дело/ }));
    await userEvent.type(screen.getByLabelText('Название'), 'Проверка чек-листа');
    await userEvent.click(screen.getByRole('button', { name: 'Создать' }));
    expect(await screen.findByText('Дело создано')).toBeInTheDocument();
    const list = await screen.findByTestId('checklist');
    await userEvent.click(within(list).getByRole('button', { name: /Добавьте доказательства/ }));
    expect(screen.getByRole('tab', { name: /Доказательства/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('#73 deletion asks in an in-app dialog; Cancel and Escape keep the item', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    renderApp('/login?next=/cases');
    await signIn();
    await openCase(/OLX/, 'Доказательства');
    const rows = await screen.findAllByTestId('evidence-row');
    await userEvent.click(within(rows[0]).getByRole('button', { name: 'Удалить' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByRole('button', { name: 'Отмена' })).toHaveFocus();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Отмена' }));
    expect(screen.getAllByTestId('evidence-row')).toHaveLength(3);
    await userEvent.click(within(screen.getAllByTestId('evidence-row')[0]).getByRole('button', { name: 'Удалить' }));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(screen.getAllByTestId('evidence-row')).toHaveLength(3);
    await userEvent.click(within(screen.getAllByTestId('evidence-row')[0]).getByRole('button', { name: 'Удалить' }));
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Удалить' }));
    await waitFor(() => expect(screen.getAllByTestId('evidence-row')).toHaveLength(2));
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('#74 #75 page title and active tab scrolled into view', async () => {
    renderApp('/login?next=/cases');
    await signIn();
    await waitFor(() => expect(document.title).toBe('Дела — Re:Trace'));
    await openCase(/вакансия/, 'Отчёты');
    expect(document.title).toBe('Фейковая вакансия оператора колл-центра — Re:Trace');
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('#77 copies an entity value', async () => {
    const writeText = vi.fn(async () => {});
    Object.assign(navigator, { clipboard: { writeText } });
    renderApp('/login?next=/cases');
    await signIn();
    await openCase(/вакансия/, 'Сущности');
    await userEvent.click(await screen.findByRole('button', { name: 'Копировать +7 700 123 45 67' }));
    expect(writeText).toHaveBeenCalledWith('+7 700 123 45 67');
    expect(await screen.findByText('Скопировано')).toBeInTheDocument();
  });

  it('#79 asks before discarding a half-filled form', async () => {
    renderApp('/login?next=/cases');
    await signIn();
    await openCase(/OLX/, 'Доказательства');
    await userEvent.click(await screen.findByRole('button', { name: /Добавить/ }));
    await userEvent.type(screen.getByLabelText('Содержание'), 'черновик');
    await userEvent.click(screen.getByRole('button', { name: 'Отмена' }));
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Продолжить' }));
    expect(screen.getByLabelText('Содержание')).toHaveValue('черновик');
    await userEvent.click(screen.getByRole('button', { name: 'Отмена' }));
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Отменить изменения' }));
    expect(screen.queryByLabelText('Содержание')).toBeNull();
  });
});

describe('account and admin', () => {
  it('#65 profile: name, password checks', async () => {
    renderApp('/login?next=/profile');
    await signIn();
    const name = await screen.findByLabelText('Имя');
    await userEvent.clear(name);
    await userEvent.type(name, 'Айгерим Н.');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(await screen.findByRole('link', { name: /Айгерим Н\./ })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Текущий пароль'), DEMO_PASSWORD);
    await userEvent.type(screen.getByLabelText('Новый пароль'), 'new-password-1');
    await userEvent.type(screen.getByLabelText('Повторите новый пароль'), 'new-password-2');
    await userEvent.click(screen.getByRole('button', { name: 'Сменить пароль' }));
    expect(await screen.findByText('Пароли не совпадают')).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText('Текущий пароль'));
    await userEvent.type(screen.getByLabelText('Текущий пароль'), 'wrong-password');
    await userEvent.clear(screen.getByLabelText('Повторите новый пароль'));
    await userEvent.type(screen.getByLabelText('Повторите новый пароль'), 'new-password-1');
    await userEvent.click(screen.getByRole('button', { name: 'Сменить пароль' }));
    expect(await screen.findByText('Неверный текущий пароль')).toBeInTheDocument();
  });

  it('#66 #67 admin disables a user, filters the audit and loads more', async () => {
    renderApp('/login?next=/admin');
    await signIn('admin@retrace.test');
    const row = (await screen.findByText('daniyar@retrace.test')).closest('tr')!;
    await userEvent.click(within(row).getByRole('button', { name: 'Отключить' }));
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Отключить' }));
    expect(await within(row).findByText('Отключён')).toBeInTheDocument();
    const own = screen.getByText('admin@retrace.test').closest('tr')!;
    expect(within(own).queryByRole('button', { name: 'Отключить' })).toBeNull();
    await userEvent.selectOptions(screen.getByLabelText('Действие'), 'user.');
    const audit = await screen.findByTestId('audit');
    await waitFor(() => expect(within(audit).getByText('отключил пользователя')).toBeInTheDocument());
    expect(within(audit).queryByText('вход')).not.toBeNull();
  });

  it('#78 sends the user to sign in when the session expires', async () => {
    const api = renderApp('/login?next=/cases');
    await signIn();
    await screen.findAllByTestId('case-row');
    await act(async () => api.expireSession());
    await userEvent.selectOptions(screen.getByLabelText('Статус'), 'open');
    expect(await screen.findByText('Сессия истекла, войдите снова')).toBeInTheDocument();
  });
});

describe('robustness', () => {
  it('#83 shows a recovery screen when rendering fails', () => {
    const Boom = () => {
      throw new Error('boom');
    };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Что-то пошло не так');
    expect(screen.getByRole('button', { name: 'Перезагрузить' })).toBeInTheDocument();
  });

  it('#82 skip link and named icon buttons', async () => {
    renderApp('/login?next=/cases');
    await signIn();
    await openCase(/вакансия/, 'Сущности');
    expect(screen.getByRole('link', { name: 'К содержимому' })).toHaveAttribute('href', '#main');
    for (const b of screen.getAllByRole('button')) expect(b).toHaveAccessibleName();
  });

  it('#81 index.html links the manifest', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const root = path.resolve(process.cwd());
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public/manifest.webmanifest'), 'utf8'));
    expect(manifest).toMatchObject({ short_name: 'Re:Trace', start_url: '/cases', display: 'standalone', theme_color: '#0b1220' });
  });
});
