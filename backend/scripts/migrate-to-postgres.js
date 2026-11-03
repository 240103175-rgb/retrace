// Usage: npm run db:migrate-to-postgres -w backend -- <source url> <target url> [--force]
// e.g. sqlite:data/retrace.db postgres://retrace:secret@localhost:5432/retrace   (#107)
import { migrateDatabase } from '../src/repositories/migrate.js';

const args = process.argv.slice(2);
const force = args.includes('--force');
const [from, to] = args.filter((a) => a !== '--force');
if (!from || !to) {
  console.error('Usage: migrate-to-postgres <source url> <target url> [--force]');
  process.exit(2);
}
const hide = (url) => url.replace(/\/\/([^:/@]+):[^@]+@/, '//$1:***@'); // never print the password
try {
  console.log(`Copying ${hide(from)} → ${hide(to)}`);
  const counts = await migrateDatabase(from, to, { force, log: (line) => console.log(`  ${line}`) });
  console.log(`Done: ${counts.reduce((n, c) => n + c.target, 0)} rows in ${counts.length} tables.`);
} catch (err) {
  console.error(`Migration failed: ${err.message}`);
  process.exit(1);
}
