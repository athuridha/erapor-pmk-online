import { createClient } from '@libsql/client';

const API_URL = 'https://erapor-d1-api.beliimei.workers.dev/query';
const API_TOKEN = 'cf99eabfa99380f9bfc410fd793db0ff587151fc20dda6fb';

async function queryD1(sql, params = []) {
	const res = await fetch(API_URL, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${API_TOKEN}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ sql, params })
	});

	if (!res.ok) {
		const txt = await res.text();
		throw new Error(`D1 HTTP error ${res.status}: ${txt}`);
	}

	const data = await res.json();
	if (!data.success) {
		throw new Error(`D1 Query error: ${JSON.stringify(data.errors)}`);
	}
	return data.result?.[0]?.results ?? [];
}

async function main() {
	const client = createClient({ url: 'file:D:/amar/pratamamulya/rapkumer-main/data/database.sqlite3' });

	// Get all table schemas and triggers/indexes
	const objects = await client.execute(
		"SELECT type, name, tbl_name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'cloud_%' ORDER BY CASE type WHEN 'table' THEN 1 WHEN 'index' THEN 2 ELSE 3 END"
	);

	console.log(`Found ${objects.rows.length} schema definitions...`);

	// 1. Create Tables
	for (const row of objects.rows) {
		if (row.type === 'table') {
			try {
				let sql = row.sql;
				if (!sql.toUpperCase().includes('IF NOT EXISTS')) {
					sql = sql.replace(/CREATE TABLE\s+["`]?(\w+)["`]?/i, 'CREATE TABLE IF NOT EXISTS "$1"');
				}
				await queryD1(sql);
				console.log(`[Schema] Table created: ${row.name}`);
			} catch (err) {
				console.warn(`[Schema] Table ${row.name} note:`, err.message);
			}
		}
	}

	// 2. Create Indexes
	for (const row of objects.rows) {
		if (row.type === 'index' && row.sql) {
			try {
				let sql = row.sql;
				if (!sql.toUpperCase().includes('IF NOT EXISTS')) {
					sql = sql.replace(/CREATE\s+(UNIQUE\s+)?INDEX\s+["`]?(\w+)["`]?/i, 'CREATE $1INDEX IF NOT EXISTS "$2"');
				}
				await queryD1(sql);
			} catch (err) {
				// Ignore duplicate index errors
			}
		}
	}

	// 3. Migrate Data for each table
	const tableRows = objects.rows.filter(r => r.type === 'table');
	for (const tbl of tableRows) {
		const tableName = tbl.name;
		const countRes = await client.execute(`SELECT COUNT(*) as c FROM "${tableName}"`);
		const total = Number(countRes.rows[0].c);

		if (total === 0) {
			console.log(`[Data] Skipping empty table: ${tableName}`);
			continue;
		}

		console.log(`[Data] Migrating ${total} rows for ${tableName}...`);
		const dataRes = await client.execute(`SELECT * FROM "${tableName}"`);
		const rows = dataRes.rows;

		// Insert in chunks of 50
		const chunkSize = 50;
		for (let i = 0; i < rows.length; i += chunkSize) {
			const chunk = rows.slice(i, i + chunkSize);
			for (const row of chunk) {
				const cols = Object.keys(row);
				const colNames = cols.map(c => `"${c}"`).join(', ');
				const placeholders = cols.map(() => '?').join(', ');
				const vals = cols.map(c => {
					const v = row[c];
					if (v instanceof ArrayBuffer || ArrayBuffer.isView(v)) {
						return Array.from(new Uint8Array(v));
					}
					return v;
				});

				const sql = `INSERT OR REPLACE INTO "${tableName}" (${colNames}) VALUES (${placeholders})`;
				await queryD1(sql, vals);
			}
		}
		console.log(`[Data] Finished ${tableName}`);
	}

	console.log('=== All schema & data successfully pushed to Cloudflare D1! ===');
}

main().catch(console.error);
