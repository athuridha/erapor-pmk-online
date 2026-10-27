import { env } from '$env/dynamic/private';
import path from 'node:path';
import fs from 'node:fs';
import { type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql/node';
import * as schema from './schema';
import { createD1HttpClient } from './d1-client';

const DEFAULT_D1_URL = 'https://erapor-d1-api.beliimei.workers.dev/query';
const DEFAULT_D1_TOKEN = 'cf99eabfa99380f9bfc410fd793db0ff587151fc20dda6fb';

function loadDotEnvIfPresent() {
	try {
		const envPath = path.resolve(process.cwd(), '.env');
		if (!fs.existsSync(envPath)) return;
		const raw = fs.readFileSync(envPath, 'utf8');
		for (const line of raw.split(/\r?\n/)) {
			const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
			if (!m) continue;
			const key = m[1];
			let val = m[2] ?? '';
			if (
				(val.startsWith('"') && val.endsWith('"')) ||
				(val.startsWith("'") && val.endsWith("'"))
			) {
				val = val.slice(1, -1);
			}
			if (!process.env[key]) {
				process.env[key] = val;
			}
		}
	} catch (e) {
		console.warn('[db] failed to read .env file:', e);
	}
}

loadDotEnvIfPresent();

const clientKey = '__eraporPmkD1Client';

function createClientInstance(): Client {
	const url = process.env.CLOUDFLARE_API_URL || env.CLOUDFLARE_API_URL || DEFAULT_D1_URL;
	const token = process.env.CLOUDFLARE_API_TOKEN || env.CLOUDFLARE_API_TOKEN || DEFAULT_D1_TOKEN;

	console.info(`[db] connecting directly to Cloudflare D1 (${url})...`);
	return createD1HttpClient({ url, token });
}

function initClient(): Client {
	const store = globalThis as unknown as Record<string, Client | undefined>;
	const existing = store[clientKey];
	if (existing) return existing;

	const client = createClientInstance();
	store[clientKey] = client;
	return client;
}

let currentClient: Client = initClient();
let currentDb = drizzle(currentClient, { casing: 'snake_case', schema });

export async function closeDbClient() {
	const store = globalThis as unknown as Record<string, Client | undefined>;
	delete store[clientKey];
}

export async function reloadDbClient() {
	try {
		await closeDbClient();
		const client = createClientInstance();
		const store = globalThis as unknown as Record<string, Client | undefined>;
		store[clientKey] = client;
		currentClient = client;
		currentDb = drizzle(currentClient, { casing: 'snake_case', schema });
		console.info('[db] reloaded Cloudflare D1 client and drizzle instance');
	} catch (e) {
		console.error('[db] failed to reload client', e);
	}
}

const dbProxy = new Proxy(
	{},
	{
		get(_t, prop) {
			const target = currentDb as unknown as Record<string, unknown>;
			const v = (target as Record<string, unknown>)[String(prop)];
			if (typeof v === 'function')
				return (v as unknown as (...args: unknown[]) => unknown).bind(target);
			return v;
		},
		set(_t, prop, value) {
			(currentDb as unknown as Record<string, unknown>)[String(prop)] = value;
			return true;
		}
	}
);

export default dbProxy as unknown as typeof currentDb;
