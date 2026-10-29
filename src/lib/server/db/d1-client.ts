import { type Client, type InStatement, type ResultSet, type Row, type Value } from '@libsql/client';

export interface D1HttpConfig {
	url: string;
	token: string;
}

function stripIdentQuotes(id: string): string {
	if (
		(id.startsWith('"') && id.endsWith('"')) ||
		(id.startsWith('`') && id.endsWith('`')) ||
		(id.startsWith('[') && id.endsWith(']'))
	) {
		return id.slice(1, -1);
	}
	return id;
}

function findTopLevelKeyword(sql: string, keyword: string, fromIndex = 0): number {
	const kw = keyword.toLowerCase();
	let depth = 0;
	let quote: string | null = null;
	for (let i = fromIndex; i < sql.length; i++) {
		const ch = sql[i];
		if (quote) {
			if (ch === quote) {
				if (sql[i + 1] === quote) {
					i++;
					continue;
				}
				quote = null;
			}
			continue;
		}
		if (ch === "'" || ch === '"' || ch === '`') {
			quote = ch;
			continue;
		}
		if (ch === '(') {
			depth++;
			continue;
		}
		if (ch === ')') {
			depth--;
			continue;
		}
		if (depth !== 0 || !/[A-Za-z_]/.test(ch)) continue;
		const prev = i === 0 ? '' : sql[i - 1];
		if (/[\w$]/.test(prev)) continue;
		if (sql.slice(i, i + kw.length).toLowerCase() !== kw) continue;
		const next = sql[i + kw.length] ?? '';
		if (/[\w$]/.test(next)) continue;
		return i;
	}
	return -1;
}

function splitTopLevelCommas(input: string): string[] {
	const parts: string[] = [];
	let depth = 0;
	let quote: string | null = null;
	let start = 0;
	for (let i = 0; i < input.length; i++) {
		const ch = input[i];
		if (quote) {
			if (ch === quote) {
				if (input[i + 1] === quote) {
					i++;
					continue;
				}
				quote = null;
			}
			continue;
		}
		if (ch === "'" || ch === '"' || ch === '`') {
			quote = ch;
			continue;
		}
		if (ch === '(') depth++;
		else if (ch === ')') depth--;
		else if (ch === ',' && depth === 0) {
			parts.push(input.slice(start, i));
			start = i + 1;
		}
	}
	parts.push(input.slice(start));
	return parts;
}

/**
 * D1's HTTP endpoint returns rows as JSON objects, so duplicate output column names
 * (`pegawai.nama` + `kelas.nama`) collapse and one value is lost. Drizzle maps rows
 * positionally, so we rewrite duplicate bare column references in the SELECT list
 * with a unique alias before sending.
 */
function aliasDuplicateSelectColumns(sql: string): string {
	const selectIdx = findTopLevelKeyword(sql, 'select', 0);
	if (selectIdx === -1) return sql;
	const fromIdx = findTopLevelKeyword(sql, 'from', selectIdx + 6);
	if (fromIdx === -1) return sql;

	const listStart = selectIdx + 6;
	const rawList = sql.slice(listStart, fromIdx);
	const distinctMatch = rawList.match(/^(\s*distinct\b\s*)/i);
	const prefix = distinctMatch ? distinctMatch[1] : '';
	const body = prefix ? rawList.slice(prefix.length) : rawList;
	const items = splitTopLevelCommas(body);

	const baseNames = items.map((item) => {
		const t = item.trim();
		if (!t || t === '*') return null;
		// Already explicitly aliased — leave it alone.
		if (/\s+as\s+(?:"[^"]*"|`[^`]*`|\[[^\]]*\]|[\w$]+)\s*$/i.test(t)) return null;
		// Only plain (possibly qualified) column references can collide.
		if (
			!/^(?:"[^"]+"|`[^`]+`|\[[^\]]+\]|[A-Za-z_][\w$]*)(?:\.(?:"[^"]+"|`[^`]+`|\[[^\]]+\]|[A-Za-z_][\w$]*))*$/.test(
				t
			)
		)
			return null;
		const segments = t.split('.');
		return stripIdentQuotes(segments[segments.length - 1]);
	});

	const counts: Record<string, number> = {};
	for (const name of baseNames) {
		if (name) counts[name] = (counts[name] ?? 0) + 1;
	}

	let changed = false;
	const rewritten = items.map((item, index) => {
		const name = baseNames[index];
		if (!name || counts[name] < 2) return item;
		changed = true;
		return `${item.trim()} as "__c${index}"`;
	});

	if (!changed) return sql;
	return sql.slice(0, listStart) + prefix + rewritten.join(',') + sql.slice(fromIdx);
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

		// D1 returns objects; alias colliding output columns so none are lost.
		sql = aliasDuplicateSelectColumns(sql);

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
