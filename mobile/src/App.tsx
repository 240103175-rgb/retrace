// Re:Trace for investigators on the phone (#28): sign in, cases, case (evidence + risk), add evidence.
// Navigation is a small screen stack in state; the session lives in memory (sign in again after a restart).
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ApiError, api, type CaseSummary, type Evidence, type EvidenceType, type Risk, type User } from './api';
import { DISCLAIMER, EVIDENCE_TYPE, LEVEL, RULE_TITLE, errorText, money, riskColor } from './text';

type Screen = { name: 'cases' } | { name: 'case'; id: number } | { name: 'add'; id: number };

const codeOf = (err: unknown) => (err instanceof ApiError ? err.code : 'server_error');

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [stack, setStack] = useState<Screen[]>([{ name: 'cases' }]);
  const screen = stack[stack.length - 1];
  const push = (s: Screen) => setStack([...stack, s]);
  const back = () => setStack(stack.slice(0, -1));

  useEffect(() => {
    api.onUnauthorized(() => setUser(null));
  }, []);

  const signOut = async () => {
    await api.logout().catch(() => undefined);
    api.setToken(null);
    setUser(null);
    setStack([{ name: 'cases' }]);
  };

  return (
    <SafeAreaView style={s.root}>
      <StatusBar style="light" />
      <View style={s.bar}>
        {user && stack.length > 1 ? (
          <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Назад">
            <Text style={s.link}>← Назад</Text>
          </Pressable>
        ) : (
          <Text style={s.brand}>
            Re<Text style={s.accent}>:</Text>Trace
          </Text>
        )}
        {user && (
          <Pressable onPress={() => void signOut()} accessibilityRole="button">
            <Text style={s.link}>Выйти</Text>
          </Pressable>
        )}
      </View>
      {!user ? (
        <Login onSignedIn={setUser} />
      ) : screen.name === 'cases' ? (
        <Cases onOpen={(id) => push({ name: 'case', id })} />
      ) : screen.name === 'case' ? (
        <Case id={screen.id} onAdd={() => push({ name: 'add', id: screen.id })} />
      ) : (
        <AddEvidence caseId={screen.id} onDone={back} />
      )}
    </SafeAreaView>
  );
}

function Login({ onSignedIn }: { onSignedIn(u: User): void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const session = await api.login({ email: email.trim(), password });
      api.setToken(session.token);
      onSignedIn(session.user);
    } catch (err) {
      setError(errorText(codeOf(err)));
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={s.page}>
      <Text style={s.h1}>Вход</Text>
      <Text style={s.muted}>Расследование подозрительных онлайн-схем</Text>
      {error && <Text style={s.error}>{error}</Text>}
      <TextInput style={s.input} placeholder="Email" placeholderTextColor="#64748b" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} accessibilityLabel="Email" />
      <TextInput style={s.input} placeholder="Пароль" placeholderTextColor="#64748b" secureTextEntry value={password} onChangeText={setPassword} accessibilityLabel="Пароль" />
      <Pressable style={s.button} onPress={() => void submit()} disabled={busy} accessibilityRole="button">
        <Text style={s.buttonText}>{busy ? 'Загрузка…' : 'Войти'}</Text>
      </Pressable>
    </View>
  );
}

function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(() => {
    setError(null);
    load().then(setData, (err) => setError(errorText(codeOf(err))));
  }, deps);
  useEffect(run, [run]);
  return { data, error, reload: run };
}

function Cases({ onOpen }: { onOpen(id: number): void }) {
  const cases = useLoad(() => api.listCases({ sort: 'risk' }), []);
  if (cases.error) return <Text style={s.error}>{cases.error}</Text>;
  if (!cases.data) return <ActivityIndicator style={s.page} color="#22d3ee" />;
  return (
    <FlatList
      contentContainerStyle={s.page}
      data={cases.data}
      keyExtractor={(c) => String(c.id)}
      ListHeaderComponent={<Text style={s.h1}>Дела</Text>}
      ListEmptyComponent={<Text style={s.muted}>Дел пока нет. Создайте первое дело в веб-версии.</Text>}
      onRefresh={cases.reload}
      refreshing={false}
      renderItem={({ item }) => <CaseRow c={item} onPress={() => onOpen(item.id)} />}
    />
  );
}

function CaseRow({ c, onPress }: { c: CaseSummary; onPress(): void }) {
  return (
    <Pressable style={s.card} onPress={onPress} accessibilityRole="button" accessibilityLabel={c.title}>
      <Text style={s.title}>{c.title}</Text>
      <View style={s.row}>
        <Text style={[s.badge, { color: riskColor(c.riskLevel) }]}>
          {c.riskScore} {LEVEL[c.riskLevel]}
        </Text>
        <Text style={s.muted}>доказательств: {c.evidenceCount}</Text>
      </View>
    </Pressable>
  );
}

function Case({ id, onAdd }: { id: number; onAdd(): void }) {
  const data = useLoad(async () => {
    const [c, evidence, risk] = await Promise.all([api.getCase(id), api.listEvidence(id), api.risk(id)]);
    return { c, evidence, risk };
  }, [id]);
  // Coming back from «add» mounts this screen again, so the list is fetched fresh.
  if (data.error) return <Text style={s.error}>{data.error}</Text>;
  if (!data.data) return <ActivityIndicator style={s.page} color="#22d3ee" />;
  const { c, evidence, risk } = data.data;
  const canAdd = (c.access ?? 'owner') === 'owner' || c.access === 'editor';
  return (
    <ScrollView contentContainerStyle={s.page}>
      <Text style={s.h1}>{c.title}</Text>
      {!!c.description && <Text style={s.muted}>{c.description}</Text>}
      <RiskCard risk={risk} />
      <View style={s.rowBetween}>
        <Text style={s.h2}>Доказательства ({evidence.length})</Text>
        {canAdd && c.status !== 'closed' && c.status !== 'archived' && (
          <Pressable onPress={onAdd} accessibilityRole="button">
            <Text style={s.link}>+ Добавить</Text>
          </Pressable>
        )}
      </View>
      {evidence.map((e: Evidence) => (
        <View key={e.id} style={s.card}>
          <Text style={s.kicker}>
            {EVIDENCE_TYPE[e.type]} · {e.verification === 'confirmed' ? 'Подтверждено' : e.verification === 'disputed' ? 'Оспорено' : 'Не проверено'}
            {e.amount != null ? ` · ${money(e.amount)}` : ''}
          </Text>
          <Text style={s.text}>{e.content}</Text>
          {!!e.source && <Text style={s.muted}>Источник: {e.source}</Text>}
        </View>
      ))}
    </ScrollView>
  );
}

function RiskCard({ risk }: { risk: Risk }) {
  return (
    <View style={s.card}>
      <Text style={[s.score, { color: riskColor(risk.level) }]}>
        {risk.score} <Text style={s.text}>{LEVEL[risk.level]}</Text>
      </Text>
      {risk.rules.length === 0 && <Text style={s.muted}>Ни одно правило не сработало.</Text>}
      {risk.rules.map((r) => (
        <Text key={r.id} style={s.text}>
          • {RULE_TITLE[r.id] ?? r.id} (+{r.weight})
        </Text>
      ))}
      <Text style={s.disclaimer}>{DISCLAIMER}</Text>
    </View>
  );
}

const TYPES: EvidenceType[] = ['message', 'link', 'account', 'payment', 'observation'];

function AddEvidence({ caseId, onDone }: { caseId: number; onDone(): void }) {
  const [type, setType] = useState<EvidenceType>('message');
  const [content, setContent] = useState('');
  const [source, setSource] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    if (!content.trim()) return setError('Содержание: от 1 до 5000 символов');
    try {
      await api.createEvidence(caseId, {
        type,
        content: content.trim(),
        source: source.trim() || null,
        amount: type === 'payment' && amount ? Number(amount) : null,
        verification: 'unverified',
      });
      onDone();
    } catch (err) {
      setError(errorText(codeOf(err)));
    }
  };
  return (
    <ScrollView contentContainerStyle={s.page}>
      <Text style={s.h1}>Новое доказательство</Text>
      {error && <Text style={s.error}>{error}</Text>}
      <View style={s.chips}>
        {TYPES.map((t) => (
          <Pressable key={t} onPress={() => setType(t)} style={[s.chip, t === type && s.chipOn]} accessibilityRole="button" accessibilityState={{ selected: t === type }}>
            <Text style={s.text}>{EVIDENCE_TYPE[t]}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput style={[s.input, s.area]} multiline placeholder="Содержание" placeholderTextColor="#64748b" value={content} onChangeText={setContent} maxLength={5000} accessibilityLabel="Содержание" />
      <TextInput style={s.input} placeholder="Источник" placeholderTextColor="#64748b" value={source} onChangeText={setSource} maxLength={200} accessibilityLabel="Источник" />
      {type === 'payment' && (
        <TextInput style={s.input} placeholder="Сумма, ₸" placeholderTextColor="#64748b" keyboardType="number-pad" value={amount} onChangeText={setAmount} accessibilityLabel="Сумма" />
      )}
      <Pressable style={s.button} onPress={() => void save()} accessibilityRole="button">
        <Text style={s.buttonText}>Сохранить</Text>
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b1220' },
  bar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: '#1e293b' },
  brand: { color: '#e2e8f0', fontSize: 18, fontWeight: '700' },
  accent: { color: '#22d3ee' },
  link: { color: '#22d3ee', fontSize: 16 },
  page: { padding: 16, gap: 12 },
  h1: { color: '#f1f5f9', fontSize: 24, fontWeight: '700' },
  h2: { color: '#f1f5f9', fontSize: 18, fontWeight: '600' },
  title: { color: '#f1f5f9', fontSize: 16, fontWeight: '600' },
  text: { color: '#e2e8f0', fontSize: 15 },
  muted: { color: '#94a3b8', fontSize: 14 },
  kicker: { color: '#22d3ee', fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
  error: { color: '#fca5a5', backgroundColor: '#451a1a', padding: 10, borderRadius: 8, margin: 16 },
  input: { backgroundColor: '#111827', color: '#f1f5f9', borderWidth: 1, borderColor: '#334155', borderRadius: 10, padding: 12, fontSize: 16 },
  area: { minHeight: 110, textAlignVertical: 'top' },
  button: { backgroundColor: '#22d3ee', borderRadius: 10, padding: 14, alignItems: 'center' },
  buttonText: { color: '#04202a', fontWeight: '700', fontSize: 16 },
  card: { backgroundColor: '#131c2e', borderWidth: 1, borderColor: '#1e293b', borderRadius: 12, padding: 14, gap: 6 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { fontWeight: '700' },
  score: { fontSize: 36, fontWeight: '700' },
  disclaimer: { color: '#94a3b8', fontSize: 13, fontStyle: 'italic', marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#334155', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  chipOn: { borderColor: '#22d3ee', backgroundColor: '#0e3a44' },
});
