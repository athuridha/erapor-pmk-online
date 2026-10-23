/// <reference types="@cloudflare/workers-types" />

interface Env {
	/** Static API key checked against the Bearer token. Rotate via `wrangler secret put API_KEY`. */
	API_KEY: string;
	DB: D1Database;
}

/** Constant-time string compare so request timing leaks nothing about the key. */
function keyMatches(input: string, secret: string): boolean {
	const a = new TextEncoder().encode(input);
	const b = new TextEncoder().encode(secret);
	const max = Math.max(a.length, b.length);
	let diff = a.length ^ b.length;
	for (let i = 0; i < max; i++) {
		diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
	}
	return diff === 0;
}

function bearerKey(request: Request): string {
	const header = request.headers.get('Authorization') || '';
	return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

function jsonError(status: number, code: number, message: string): Response {
	return Response.json({ success: false, errors: [{ code, message }] }, { status });
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		if (request.method === 'GET' && (url.pathname === '/health' || url.pathname === '/health/')) {
			return new Response('ok', { headers: { 'Content-Type': 'text/plain' } });
		}

		if (request.method !== 'POST') {
			return jsonError(404, 7000, 'Rute tidak ditemukan.');
		}

		if (!env.API_KEY) {
			return jsonError(500, 7000, 'API key worker belum diatur (wrangler secret put API_KEY).');
		}
		if (!keyMatches(bearerKey(request), env.API_KEY)) {
			return jsonError(401, 9109, 'API key tidak valid.');
		}

		if (url.pathname !== '/query' && url.pathname !== '/query/') {
			return jsonError(404, 7000, 'Rute tidak ditemukan. Gunakan POST /query.');
		}

		let body: { sql?: string; params?: unknown[] };
		try {
			body = await request.json();
		} catch {
			return jsonError(400, 7000, 'Body harus berupa JSON.');
		}

		if (typeof body.sql !== 'string' || !body.sql.trim()) {
			return jsonError(400, 7000, 'Kolom "sql" wajib diisi.');
		}
		if (body.params !== undefined && !Array.isArray(body.params)) {
			return jsonError(400, 7000, 'Kolom "params" harus berupa array.');
		}

		try {
			const stmt = env.DB.prepare(body.sql).bind(...(body.params ?? []));
			const { results, meta } = await stmt.all();
			return Response.json({ success: true, result: { results, meta }, errors: [] });
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Kesalahan menjalankan kueri.';
			return jsonError(500, 1000, message);
		}
	}
};
