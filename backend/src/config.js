// Environment settings, validated before the server starts (#37).
function adminPassword(value) {
  if (value === undefined || value === '') return null;
  if (value.length < 12) throw new Error('ADMIN_PASSWORD must be at least 12 characters');
  return value;
}

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
    // #106 synthetic demo data: on by default outside production; a public demo sets SEED_DEMO=true.
    seedDemo: env.SEED_DEMO === undefined || env.SEED_DEMO === '' ? env.NODE_ENV !== 'production' : env.SEED_DEMO === 'true',
    // Replaces the demo admin password so a public demo's admin is not the documented one.
    adminPassword: adminPassword(env.ADMIN_PASSWORD),
  };
}
