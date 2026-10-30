import db from '$lib/server/db';
import { tableAuthUser } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export async function GET({ url, locals }: { url: URL; locals: App.Locals }) {
	if (!locals.user) {
		return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 });
	}
	const username = url.searchParams.get('username')?.trim();
	if (!username)
		return new Response(JSON.stringify({ error: 'username required' }), { status: 400 });
	const normalized = username.toLowerCase();
	const user = await db.query.tableAuthUser.findFirst({
		where: eq(tableAuthUser.usernameNormalized, normalized),
		columns: { id: true, username: true }
	});
	// Return same shape whether found or not to prevent enumeration timing differences
	if (!user) return new Response(JSON.stringify({ found: false, user: null }), { status: 200 });
	return new Response(JSON.stringify({ found: true, user }), { status: 200 });
}
