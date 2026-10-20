import { useState, type FormEvent } from 'react';
import { ENTITY_ICON, ENTITY_TYPE, RELATIONSHIP, T, t } from '../lib/text';
import { useToast } from '../lib/toast';
import { errorKey, useAsync } from '../lib/useAsync';
import type { CaseTabProps } from '../pages/CasePage';
import { useApi } from '../services/ApiContext';
import type { Entity, EntityType, RelationshipType } from '../services/types';
import { Empty, ErrorBox, Field, FormError, Loading } from './ui';

export function EntitiesTab({ caseData, editable, onChanged }: CaseTabProps) {
  const api = useApi();
  const toast = useToast();
  const data = useAsync(
    async () => {
      const [entities, relationships, evidence] = await Promise.all([
        api.listEntities(caseData.id),
        api.listRelationships(caseData.id),
        api.listEvidence(caseData.id),
      ]);
      return { entities, relationships, evidence };
    },
    [api, caseData.id],
  );
  const [entityForm, setEntityForm] = useState<{ type: EntityType; label: string; note: string } | null>(null);
  const [linkForm, setLinkForm] = useState<{ sourceId: string; targetId: string; type: RelationshipType; evidenceIds: number[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const after = (msg: string) => {
    toast('ok', msg);
    setError(null);
    data.reload();
    onChanged();
  };

  const addEntity = async (e: FormEvent) => {
    e.preventDefault();
    if (!entityForm) return;
    if (!entityForm.label.trim()) {
      setError('Обозначение: от 1 до 200 символов');
      return;
    }
    try {
      await api.createEntity(caseData.id, { type: entityForm.type, label: entityForm.label, note: entityForm.note || null });
      setEntityForm(null);
      after(T.ok_created);
    } catch (err) {
      setError(t(errorKey(err)));
    }
  };

  const addLink = async (e: FormEvent) => {
    e.preventDefault();
    if (!linkForm) return;
    try {
      await api.createRelationship(caseData.id, {
        sourceId: Number(linkForm.sourceId),
        targetId: Number(linkForm.targetId),
        type: linkForm.type,
        evidenceIds: linkForm.evidenceIds,
      });
      setLinkForm(null);
      after(T.ok_created);
    } catch (err) {
      setError(t(errorKey(err)));
    }
  };

  const remove = async (fn: () => Promise<void>) => {
    if (!window.confirm(T.confirmDelete)) return;
    try {
      await fn();
      after(T.ok_deleted);
    } catch (err) {
      toast('err', t(errorKey(err)));
    }
  };

  if (data.error) return <ErrorBox error={data.error} onRetry={data.reload} />;
  if (!data.data) return <Loading />;
  const { entities, relationships, evidence } = data.data;
  const byId = new Map<number, Entity>(entities.map((en) => [en.id, en]));
  const name = (id: number) => {
    const en = byId.get(id);
    return en ? `${ENTITY_ICON[en.type]} ${en.label}` : '?';
  };

  return (
    <>
      <FormError message={error} />
      <div className="tab-head">
        <h2>{T.entities}</h2>
        {editable && !entityForm && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => (setError(null), setEntityForm({ type: 'account', label: '', note: '' }))}>
            + {T.add}
          </button>
        )}
      </div>
      {entityForm && (
        <form className="form subpanel" onSubmit={addEntity} noValidate>
          <div className="grid-2">
            <Field label={T.type}>
              <select value={entityForm.type} onChange={(e) => setEntityForm({ ...entityForm, type: e.target.value as EntityType })}>
                {(Object.keys(ENTITY_TYPE) as EntityType[]).map((k) => (
                  <option key={k} value={k}>
                    {ENTITY_TYPE[k]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={T.label}>
              <input value={entityForm.label} onChange={(e) => setEntityForm({ ...entityForm, label: e.target.value })} maxLength={200} />
            </Field>
          </div>
          <Field label={T.note}>
            <input value={entityForm.note} onChange={(e) => setEntityForm({ ...entityForm, note: e.target.value })} maxLength={1000} />
          </Field>
          <div className="row-end">
            <button type="button" className="btn btn-ghost" onClick={() => setEntityForm(null)}>
              {T.cancel}
            </button>
            <button className="btn btn-primary">{T.save}</button>
          </div>
        </form>
      )}
      {entities.length === 0 ? (
        <Empty>{T.noEntities}</Empty>
      ) : (
        <ul className="chips-list">
          {entities.map((en) => (
            <li key={en.id} className={`entity entity-${en.type}`} data-testid="entity">
              <span className="entity-icon">{ENTITY_ICON[en.type]}</span>
              <span>
                <b className={en.type === 'link' || en.type === 'card' || en.type === 'phone' ? 'mono' : ''}>{en.label}</b>
                <small>
                  {ENTITY_TYPE[en.type]}
                  {en.note ? ` · ${en.note}` : ''}
                </small>
              </span>
              {editable && (
                <button type="button" className="icon-btn" aria-label={`${T.delete} ${en.label}`} onClick={() => void remove(() => api.deleteEntity(caseData.id, en.id))}>
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="tab-head">
        <h2>{T.relationships}</h2>
        {editable && !linkForm && entities.length >= 2 && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => (setError(null), setLinkForm({ sourceId: String(entities[0].id), targetId: String(entities[1].id), type: 'contacted', evidenceIds: [] }))}
          >
            + {T.add}
          </button>
        )}
      </div>
      {linkForm && (
        <form className="form subpanel" onSubmit={addLink}>
          <div className="grid-3">
            <Field label={T.from}>
              <select value={linkForm.sourceId} onChange={(e) => setLinkForm({ ...linkForm, sourceId: e.target.value })}>
                {entities.map((en) => (
                  <option key={en.id} value={en.id}>
                    {name(en.id)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={T.linkType}>
              <select value={linkForm.type} onChange={(e) => setLinkForm({ ...linkForm, type: e.target.value as RelationshipType })}>
                {(Object.keys(RELATIONSHIP) as RelationshipType[]).map((k) => (
                  <option key={k} value={k}>
                    {RELATIONSHIP[k]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={T.to}>
              <select value={linkForm.targetId} onChange={(e) => setLinkForm({ ...linkForm, targetId: e.target.value })}>
                {entities.map((en) => (
                  <option key={en.id} value={en.id}>
                    {name(en.id)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {evidence.length > 0 && (
            <fieldset className="checks">
              <legend>{T.supportedBy}</legend>
              {evidence.map((ev) => (
                <label key={ev.id}>
                  <input
                    type="checkbox"
                    checked={linkForm.evidenceIds.includes(ev.id)}
                    onChange={(e) =>
                      setLinkForm({
                        ...linkForm,
                        evidenceIds: e.target.checked ? [...linkForm.evidenceIds, ev.id] : linkForm.evidenceIds.filter((x) => x !== ev.id),
                      })
                    }
                  />
                  {ev.content.slice(0, 70)}
                </label>
              ))}
            </fieldset>
          )}
          <div className="row-end">
            <button type="button" className="btn btn-ghost" onClick={() => setLinkForm(null)}>
              {T.cancel}
            </button>
            <button className="btn btn-primary">{T.save}</button>
          </div>
        </form>
      )}
      {relationships.length === 0 ? (
        <p className="muted">{T.noRelationships}</p>
      ) : (
        <ul className="items">
          {relationships.map((r) => (
            <li key={r.id} className="item rel" data-testid="relationship">
              <span>{name(r.sourceId)}</span>
              <span className="rel-type">{RELATIONSHIP[r.type]}</span>
              <span>{name(r.targetId)}</span>
              <span className="muted small">
                {T.evidence}: {r.evidenceIds.length}
              </span>
              {editable && (
                <button type="button" className="icon-btn" aria-label={T.delete} onClick={() => void remove(() => api.deleteRelationship(caseData.id, r.id))}>
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
