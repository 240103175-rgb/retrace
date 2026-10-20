// Environment settings, validated before the server starts (#37).
export function loadConfig(env = process.env) {
  const port = env.PORT === undefined || env.PORT === '' ? 3200 : Number(env.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`PORT must be an integer 1–65535, got "${env.PORT}"`);
  const storage = env.STORAGE || 'sql';
  if (!['sql', 'memory'].includes(storage)) throw new Error(`STORAGE must be "sql" or "memory", got "${env.STORAGE}"`);
  return {
    port,
    storage,
    databaseUrl: env.DATABASE_URL || 'sqlite:data/retrace.db',
    production: env.NODE_ENV === 'production',
  };
}
