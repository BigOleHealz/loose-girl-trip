// Credentials stay in the ignored env file and are never written to stdout.
import nextEnv from '@next/env';
import { spawnSync } from 'node:child_process';
nextEnv.loadEnvConfig(process.cwd());
const [operation, file] = process.argv.slice(2);
if (!['push', 'query', 'advisors'].includes(operation)) throw new Error('Use push, query <file>, or advisors');
const connection = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
if (!connection) throw new Error('Pull the Supabase connection variables from Vercel first.');
const flags = operation === 'query' ? ['--file', file] : operation === 'advisors' ? ['--type', 'security', '--level', 'warn', '--fail-on', 'error'] : ['--yes'];
const run = spawnSync('npx', ['--yes', 'supabase@latest', 'db', operation, '--db-url', connection, ...flags], { encoding: 'utf8' });
let output = `${run.stdout || ''}${run.stderr || ''}`;
// Redact complete values and decoded password/URL components on error paths too.
for (const [name, value] of Object.entries(process.env)) {
  if (value && /KEY|TOKEN|SECRET|PASSWORD|POSTGRES.*URL/.test(name)) output = output.split(value).join('[REDACTED]');
}
output = output.replace(/postgres(?:ql)?:\/\/\S+/gi, '[REDACTED DATABASE URL]');
const url = new URL(connection);
for (const component of [url.password, decodeURIComponent(url.password)]) if (component) output = output.split(component).join('[REDACTED]');
process.stdout.write(output);
process.exit(run.status ?? 1);
