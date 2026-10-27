import { createClient } from '@libsql/client';

async function main() {
	const client = createClient({ url: 'file:D:/amar/pratamamulya/rapkumer-main/data/database.sqlite3' });
	const tables = await client.execute("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
	console.log('Tables found count:', tables.rows.length);
	for (const t of tables.rows) {
		console.log('-', t.name);
	}
}

main().catch(console.error);
