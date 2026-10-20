import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { layout } from '../components/GraphTab';
import { createMockService, DEMO_PASSWORD } from '../services/mockService';

const AIGERIM = 'aigerim@retrace.test';
const ADMIN = 'admin@retrace.test';

function renderApp(path: string, api = createMockService({ latency: 0 })) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App api={api} mock router={false} />
    </MemoryRouter>,
  );
  return api;
}

async function signIn(email: string, password = DEMO_PASSWORD) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Email'), email);
  await user.type(screen.getByLabelText('Пароль'), password);
  await user.click(screen.getByRole('button', { name: 'Войти' }));
}

async function openCase(title: RegExp) {
  await userEvent.click(await screen.findByText(title));
  await screen.findByRole('tab', { name: /Граф/ });
}

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

describe('sign-in', () => {
  it('redirects to login and back, and rejects a wrong password', async () => {
    renderApp('/cases');
    await signIn(AIGERIM, 'wrong-password');
    expect(await screen.findByRole('alert')).toHaveTextContent('Неверный email или пароль');
    await userEvent.clear(screen.getByLabelText('Пароль'));
    await userEvent.type(screen.getByLabelText('Пароль'), DEMO_PASSWORD);
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }));
    expect(await screen.findAllByTestId('case-row')).toHaveLength(2);
  });

  it('validates the registration password length', async () => {
    renderApp('/login');
    await userEvent.click(await screen.findByRole('button', { name: /Регистрация/ }));
    await userEvent.type(screen.getByLabelText('Имя'), 'Тест');
    await userEvent.type(screen.getByLabelText('Email'), 'new@retrace.test');
    await userEvent.type(screen.getByLabelText('Пароль'), 'short');
    await userEvent.click(screen.getByRole('button', { name: 'Создать аккаунт' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('не короче 8');
  });
});

describe('cases', () => {
  it('searches, filters and creates a case', async () => {
    renderApp('/login?next=/cases');
    await signIn(AIGERIM);
    await screen.findAllByTestId('case-row');
    await userEvent.type(screen.getByLabelText('Поиск по названию и описанию'), 'вакансия');
    await waitFor(() => expect(screen.getAllByTestId('case-row')).toHaveLength(1));
    await userEvent.clear(screen.getByLabelText('Поиск по названию и описанию'));
    await userEvent.selectOptions(screen.getByLabelText('Статус'), 'closed');
    expect(await screen.findByText(/Ничего не найдено/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Новое дело/ }));
    await userEvent.type(screen.getByLabelText('Название'), 'AB');
    await userEvent.click(screen.getByRole('button', { name: 'Создать' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('от 3 до 120');
    await userEvent.type(screen.getByLabelText('Название'), 'C — новое дело');
    await userEvent.click(screen.getByRole('button', { name: 'Создать' }));
    expect(await screen.findByRole('heading', { name: 'ABC — новое дело' })).toBeInTheDocument();
  });

  it('shows an error with Retry when the service fails', async () => {
    const api = createMockService({ latency: 0 });
    renderApp('/login?next=/cases', api);
    await signIn(AIGERIM);
    await screen.findAllByTestId('case-row');
    api.failNext('network', 0);
    await userEvent.selectOptions(screen.getByLabelText('Статус'), 'open');
    expect(await screen.findByText(/Не удалось связаться с сервером/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(await screen.findAllByTestId('case-row')).toHaveLength(1);
  });
});

describe('case work', () => {
  it('adds evidence, entities and a relationship, refuses a self-link', async () => {
    renderApp('/login?next=/cases');
    await signIn(AIGERIM);
    await openCase(/OLX/);
    await userEvent.click(screen.getByRole('tab', { name: /Доказательства/ }));
    await userEvent.click(await screen.findByRole('button', { name: /Добавить/ }));
    await userEvent.type(screen.getByLabelText('Содержание'), 'Покупатель удалил объявление');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(screen.getAllByTestId('evidence-row')).toHaveLength(4));

    await userEvent.click(screen.getByRole('tab', { name: /Сущности/ }));
    const addButtons = await screen.findAllByRole('button', { name: /Добавить/ });
    await userEvent.click(addButtons[1]);
    await userEvent.selectOptions(screen.getByLabelText('Куда'), screen.getAllByRole('option', { name: /Покупатель/ })[1]);
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Неверная связь');
    await userEvent.selectOptions(screen.getByLabelText('Куда'), screen.getAllByRole('option', { name: /\+7 747/ })[1]);
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(screen.getAllByTestId('relationship')).toHaveLength(3));
  });

  it('draws the graph and explains the risk', async () => {
    renderApp('/login?next=/cases');
    await signIn(AIGERIM);
    await openCase(/вакансия/);
    await userEvent.click(screen.getByRole('tab', { name: 'Граф' }));
    expect(await screen.findAllByTestId('graph-node')).toHaveLength(5);
    expect(screen.getAllByTestId('graph-edge')).toHaveLength(5);
    await userEvent.click(screen.getByRole('button', { name: 'Аккаунт @hr_manager_astana' }));
    expect(screen.getByText('Связей с другими:')).toHaveTextContent('3');

    await userEvent.click(screen.getByRole('tab', { name: 'Риск' }));
    const risk = await screen.findByTestId('risk-view');
    expect(within(risk).getByText('65')).toBeInTheDocument();
    expect(within(risk).getByText('Высокий')).toBeInTheDocument();
    expect(within(risk).getByText('Подозрительная ссылка')).toBeInTheDocument();
    expect(within(risk).getAllByText(/имитация известного бренда/).length).toBe(2);
    expect(within(risk).getByText('Это индикатор риска, а не доказательство мошенничества.')).toBeInTheDocument();
  });

  it('keeps a report unchanged after the case is renamed and locks closed cases', async () => {
    renderApp('/login?next=/cases');
    await signIn(AIGERIM);
    await openCase(/вакансия/);
    await userEvent.click(screen.getByRole('tab', { name: 'Отчёты' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Сформировать отчёт' }));
    await screen.findByTestId('report-row');
    await userEvent.click(screen.getByRole('button', { name: 'Изменить' }));
    const title = screen.getByLabelText('Название');
    await userEvent.clear(title);
    await userEvent.type(title, 'Новое имя дела');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await screen.findByRole('heading', { name: 'Новое имя дела' });
    await userEvent.click(within(screen.getByTestId('report-row')).getByRole('link'));
    expect(await screen.findByRole('heading', { name: 'Фейковая вакансия оператора колл-центра' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: /Назад/ }));
    await userEvent.selectOptions(await screen.findByLabelText('Статус'), 'closed');
    expect(await screen.findByText(/Дело закрыто для изменений/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: /Доказательства/ }));
    await screen.findAllByTestId('evidence-row');
    expect(screen.queryByRole('button', { name: /Добавить/ })).not.toBeInTheDocument();
  });
});

describe('admin', () => {
  it('keeps investigators out', async () => {
    renderApp('/login?next=/admin');
    await signIn(AIGERIM);
    expect(await screen.findByText('Нет доступа')).toBeInTheDocument();
  });

  it('shows stats, all cases, audit, and protects the last admin', async () => {
    renderApp('/login?next=/admin');
    await signIn(ADMIN);
    expect(await screen.findByText('Статистика')).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByTestId('case-row')).toHaveLength(3));
    await userEvent.selectOptions(await screen.findByLabelText(`Роль ${ADMIN}`), 'investigator');
    expect(await screen.findByText('Нельзя снять роль с последнего администратора')).toBeInTheDocument();
    const audit = await screen.findByTestId('audit');
    expect(within(audit).getAllByText('вход').length).toBeGreaterThan(0);
  });
});

describe('graph layout', () => {
  it('places 40 nodes without overlapping centres', () => {
    const nodes = Array.from({ length: 40 }, (_, i) => ({ id: i + 1, type: 'person' as const, label: `n${i}`, degree: 0 }));
    const pos = [...layout({ nodes, edges: [] }).values()];
    const keys = new Set(pos.map((p) => `${p.x.toFixed(1)}:${p.y.toFixed(1)}`));
    expect(keys.size).toBe(40);
  });
});
