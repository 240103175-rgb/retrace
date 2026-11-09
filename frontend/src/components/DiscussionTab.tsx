// #150 comments and tasks of a case. Owner and editors write; viewers read; locked cases are read-only.
import { useState, type FormEvent } from 'react';
import { useAuth } from '../lib/auth';
import { dateTime } from '../lib/format';
import { T, t } from '../lib/text';
import { useToast } from '../lib/toast';
import { errorKey, useAsync } from '../lib/useAsync';
import type { CaseTabProps } from '../pages/CasePage';
import { useApi } from '../services/ApiContext';
import { useConfirm } from './kit';
import { Empty, ErrorBox, Loading } from './ui';

export function DiscussionTab({ caseData, editable, onChanged }: CaseTabProps) {
  const api = useApi();
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useAuth();
  const data = useAsync(async () => {
    const [comments, tasks, members] = await Promise.all([api.listComments(caseData.id), api.listTasks(caseData.id), api.listMembers(caseData.id)]);
    return { comments, tasks, people: [{ userId: caseData.ownerId, name: caseData.ownerName }, ...members] };
  }, [api, caseData.id]);
  const [text, setText] = useState('');
  const [task, setTask] = useState({ title: '', assigneeId: '' });

  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      data.reload();
      onChanged();
    } catch (err) {
      toast('err', t(errorKey(err)));
    }
  };
  const send = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    void run(async () => {
      await api.addComment(caseData.id, text.trim());
      setText('');
    });
  };
  const addTask = (e: FormEvent) => {
    e.preventDefault();
    if (!task.title.trim()) return;
    void run(async () => {
      await api.addTask(caseData.id, { title: task.title.trim(), assigneeId: task.assigneeId ? Number(task.assigneeId) : null });
      setTask({ title: '', assigneeId: '' });
    });
  };

  if (data.error) return <ErrorBox error={data.error} onRetry={data.reload} />;
  if (!data.data) return <Loading />;
  const { comments, tasks, people } = data.data;
  return (
    <div className="discussion">
      <section aria-labelledby="tasks-title">
        <h2 id="tasks-title">{T.tasks}</h2>
        {tasks.length === 0 ? (
          <Empty>{T.noTasks}</Empty>
        ) : (
          <ul className="task-list" data-testid="tasks">
            {tasks.map((tk) => (
              <li key={tk.id} className={tk.done ? 'is-done' : ''}>
                <label>
                  <input type="checkbox" checked={tk.done} disabled={!editable} onChange={(e) => void run(() => api.updateTask(caseData.id, tk.id, { done: e.target.checked }))} />{' '}
                  {tk.title}
                </label>
                <span className="muted small">{tk.assigneeName ?? T.nobody}</span>
                {editable && (tk.createdBy === user?.id || caseData.access === 'owner') && (
                  <button type="button" className="icon-btn" aria-label={`${T.deleteTask}: ${tk.title}`} onClick={() => void run(() => api.deleteTask(caseData.id, tk.id))}>
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {editable && (
          <form className="task-form" onSubmit={addTask}>
            <input aria-label={T.addTask} placeholder={T.addTask} value={task.title} maxLength={200} onChange={(e) => setTask({ ...task, title: e.target.value })} />
            <select aria-label={T.assignee} value={task.assigneeId} onChange={(e) => setTask({ ...task, assigneeId: e.target.value })}>
              <option value="">{T.nobody}</option>
              {people.map((p) => (
                <option key={p.userId} value={p.userId}>
                  {p.name}
                </option>
              ))}
            </select>
            <button className="btn btn-primary btn-sm">{T.add}</button>
          </form>
        )}
      </section>

      <section aria-labelledby="comments-title">
        <h2 id="comments-title">{T.comments}</h2>
        {comments.length === 0 ? (
          <Empty>{T.noComments}</Empty>
        ) : (
          <ul className="comment-list" data-testid="comments">
            {comments.map((c) => (
              <li key={c.id}>
                <div className="row-between">
                  <b>{c.authorName}</b>
                  <span className="muted small">{dateTime(c.createdAt)}</span>
                </div>
                <p>{c.text}</p>
                {editable && c.authorId === user?.id && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() => void confirm({ title: T.deleteComment, text: c.text.slice(0, 120) }).then((ok) => {
                      if (ok) void run(() => api.deleteComment(caseData.id, c.id));
                    })}
                  >
                    {T.delete}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {editable && (
          <form className="comment-form" onSubmit={send}>
            <textarea aria-label={T.addComment} placeholder={T.addComment} value={text} maxLength={2000} rows={3} onChange={(e) => setText(e.target.value)} />
            <button className="btn btn-primary btn-sm">{T.send}</button>
          </form>
        )}
      </section>
    </div>
  );
}
