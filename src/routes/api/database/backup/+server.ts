import { error } from '@sveltejs/kit';
import { readFile, stat } from 'node:fs/promises';
import db from '$lib/server/db';
import { resolveDatabasePath } from '$lib/server/db-url';
import { isAdminUser } from '../../../pengguna/permissions';

export async function GET({ locals }) {
	const user = locals.user;
	if (!isAdminUser(user)) {
		throw error(403, 'Hanya admin dan kepala sekolah yang dapat mengunduh backup database.');
	}

	const dbPath = resolveDatabasePath();

	try {
		await stat(dbPath);
	} catch (cause) {
		console.error('Database file not found', cause);
		throw error(404, 'Berkas database tidak ditemukan');
	}

	// Checkpoint WAL on the main server client to flush all changes to the main DB file
	try {
		await (db.$client as { execute: (sql: { sql: string }) => Promise<unknown> }).execute({
			sql: 'PRAGMA wal_checkpoint(FULL)'
		});
	} catch (err) {
		console.warn('[backup] WAL checkpoint warning:', err);
	}

	const fileBuffer = await readFile(dbPath);
	const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
	const filename = `erapor-pmk-backup-${timestamp}.sqlite3`;
	const body = new Uint8Array(fileBuffer);

	return new Response(body, {
		headers: {
			'Content-Type': 'application/vnd.sqlite3',
			'Content-Disposition': `attachment; filename="${filename}"`,
			'Content-Length': fileBuffer.length.toString()
		}
	});
}
