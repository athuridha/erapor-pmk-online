import { createD1HttpClient } from '../src/lib/server/db/d1-client.ts';
import { drizzle } from 'drizzle-orm/libsql/node';
import * as schema from '../src/lib/server/db/schema.ts';

const D1_API_URL = process.env.CLOUDFLARE_API_URL || 'https://erapor-d1-api.beliimei.workers.dev/query';
const D1_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || 'cf99eabfa99380f9bfc410fd793db0ff587151fc20dda6fb';

async function test() {
	console.log('Testing Drizzle over D1 Client...');
	const client = createD1HttpClient({ url: D1_API_URL, token: D1_API_TOKEN });
	const db = drizzle(client, { casing: 'snake_case', schema });

	const sekolah = await db.query.tableSekolah.findFirst();
	console.log('Sekolah in D1:', sekolah?.nama, sekolah?.npsn);

	const guruCount = await db.query.tablePegawai.findMany({ limit: 3 });
	console.log('Guru sample in D1:', guruCount.map(g => g.nama));

	const muridCount = await db.query.tableMurid.findMany({ limit: 3 });
	console.log('Murid sample in D1:', muridCount.map(m => m.nama));
}

test().catch(console.error);
