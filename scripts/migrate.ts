// Apply supabase/migrations/*.sql in order, once each. Needs SUPABASE_DB_URL (Supabase dashboard:
// Project Settings > Database > Connection string, "Session pooler" URI with your DB password).
import 'dotenv/config'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'

const url = process.env.SUPABASE_DB_URL
if (!url) {
  console.error('SUPABASE_DB_URL is not set. Add it to .env, or paste supabase/migrations/*.sql into the Supabase SQL editor.')
  process.exit(1)
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
await client.connect()
try {
  await client.query('create table if not exists schema_migrations (name text primary key, applied_at timestamptz default now())')
  const applied = new Set((await client.query<{ name: string }>('select name from schema_migrations')).rows.map((r) => r.name))
  const dir = join(process.cwd(), 'supabase', 'migrations')
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    if (applied.has(file)) {
      console.log(`skip  ${file}`)
      continue
    }
    await client.query('begin')
    try {
      await client.query(readFileSync(join(dir, file), 'utf8'))
      await client.query('insert into schema_migrations(name) values ($1)', [file])
      await client.query('commit')
      console.log(`apply ${file}`)
    } catch (err) {
      await client.query('rollback')
      throw err
    }
  }
} finally {
  await client.end()
}
