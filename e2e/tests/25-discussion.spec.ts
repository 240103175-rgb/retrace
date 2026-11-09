// #151 an editor adds a task for the owner; the owner completes it; comments are shared.
import { expect, signIn, test } from '../fixtures';

test('owner and editor discuss a case and split tasks', async ({ browser, api }) => {
  const owner = await api.newUser('disc-owner');
  const editor = await api.newUser('disc-editor');
  const c = await api.createCase(owner, 'Совместная проверка');
  await api.call('POST', `/cases/${c.id}/members`, owner.token, { email: editor.email, role: 'editor' });

  const ed = await (await browser.newContext()).newPage();
  await signIn(ed, editor.email, editor.password, `/cases/${c.id}?tab=discussion`);
  await ed.getByLabel('Новая задача').fill('Запросить выписку в банке');
  await ed.getByLabel('Исполнитель').selectOption({ label: owner.name });
  await ed.getByRole('button', { name: 'Добавить' }).click();
  await expect(ed.getByTestId('tasks')).toContainText(owner.name);
  await ed.getByLabel('Написать комментарий').fill('Номер зарегистрирован неделю назад');
  await ed.getByRole('button', { name: 'Отправить' }).click();
  await expect(ed.getByTestId('comments')).toContainText('Номер зарегистрирован неделю назад');

  const ow = await (await browser.newContext()).newPage();
  await signIn(ow, owner.email, owner.password, `/cases/${c.id}?tab=discussion`);
  await expect(ow.getByRole('tab', { name: /Обсуждение/ })).toContainText('1');
  await expect(ow.getByTestId('comments')).toContainText(editor.name);
  await ow.getByRole('checkbox', { name: /Запросить выписку/ }).click(); // saved first, then shown as done
  await expect(ow.getByRole('tab', { name: /Обсуждение/ })).not.toContainText('1');
});
