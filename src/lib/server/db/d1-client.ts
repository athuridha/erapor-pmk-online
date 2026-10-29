import { type Client, type InStatement, type ResultSet, type Row, type Value } from '@libsql/client';

export interface D1HttpConfig {
	url: string;
	token: string;
}

/**
 * LibSQL-compatible Client implementation that dispatches SQL to Cloudflare D1 HTTP endpoint.
 */
export function createD1HttpClient(config: D1HttpConfig): Client {
	async function executeQuery(stmt: InStatement): Promise<ResultSet> {
		let sql: string;
		let args: Value[] = [];

		if (typeof stmt === 'string') {
			sql = stmt;
		} else if (typeof stmt === 'object' && stmt !== null) {
			sql = stmt.sql;
			if (Array.isArray(stmt.args)) {
				args = stmt.args as Value[];
			} else if (stmt.args && typeof stmt.args === 'object') {
				args = Object.values(stmt.args) as Value[];
			}
		} else {
			throw new Error('Invalid SQL statement');
		}

		// Skip PRAGMA journal_mode/synchronous which are not valid on Cloudflare D1
		const trimmedSql = sql.trim().toUpperCase();
		if (
			trimmedSql.startsWith('PRAGMA JOURNAL_MODE') ||
			trimmedSql.startsWith('PRAGMA SYNCHRONOUS') ||
			trimmedSql.startsWith('PRAGMA BUSY_TIMEOUT')
		) {
			return {
				columns: [],
				columnTypes: [],
				rows: [],
				rowsAffected: 0,
				lastInsertRowid: undefined,
				toJSON: () => ({})
			};
		}

		// Normalize args: D1 expects blobs as number arrays or standard primitives
		const params = args.map((v) => {
			if (v === null || v === undefined) return null;
			if (Buffer.isBuffer(v) || v instanceof Uint8Array || (typeof v === 'object' && 'type' in v && (v as { type: string }).type === 'Buffer')) {
				return Array.from(new Uint8Array((v as { data?: ArrayLike<number> }).data || (v as ArrayLike<number>)));
			}
			return v;
		});

		const res = await fetch(config.url, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${config.token}`,
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
			const errMsg = data.errors?.[0]?.message || 'D1 query failed';
			throw new Error(`D1 Query Error: ${errMsg}`);
		}

		const rawResults = data.result?.results ?? data.result?.[0]?.results ?? [];
		const meta = data.result?.meta ?? data.result?.[0]?.meta ?? {};

		const columns = rawResults.length > 0 ? Object.keys(rawResults[0]) : [];
		const rows: Row[] = rawResults.map((r: Record<string, unknown>) => {
			// In @libsql/client, Row is an Array of values with named properties attached!
			const rowArr: unknown[] = columns.map((col) => r[col]);
			columns.forEach((col) => {
				(rowArr as unknown as Record<string, unknown>)[col] = r[col];
			});
			return rowArr as unknown as Row;
		});

		return {
			columns,
			columnTypes: columns.map(() => 'text'),
			rows,
			rowsAffected: meta.changes ?? 0,
			lastInsertRowid: meta.last_row_id !== undefined ? BigInt(meta.last_row_id) : undefined,
			toJSON: () => ({
				columns,
				columnTypes: columns.map(() => 'text'),
				rows,
				rowsAffected: meta.changes ?? 0,
				lastInsertRowid: meta.last_row_id !== undefined ? Number(meta.last_row_id) : undefined
			})
		};
	}

	const client: Partial<Client> = {
		execute: executeQuery,
		batch: async (stmts: InStatement[], mode?: 'write' | 'read' | 'deferred') => {
			const results: ResultSet[] = [];
			for (const stmt of stmts) {
				results.push(await executeQuery(stmt));
			}
			return results;
		},
		transaction: async (mode?: 'write' | 'read' | 'deferred') => {
			return {
				execute: executeQuery,
				batch: async (stmts: InStatement[]) => {
					const results: ResultSet[] = [];
					for (const stmt of stmts) {
						results.push(await executeQuery(stmt));
					}
					return results;
				},
				commit: async () => {},
				rollback: async () => {},
				close: () => {}
			} as any;
		},
		close: () => {}
	};

	return client as Client;
}
