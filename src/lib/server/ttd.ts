import fs from 'node:fs/promises';
import path from 'node:path';
import { eq, like } from 'drizzle-orm';
import db from '$lib/server/db';
import { dataRoot } from '$lib/server/data-dirs';
import { tableBukuTamu, tablePegawai, tablePresensiGuru } from '$lib/server/db/schema';

export type TtdKategori = 'guru' | 'tamu' | 'pegawai';

// Signatures are stored as transparent PNG files under <root>/ttd/<kategori>/,
// alongside the other user data (database, uploads, dinas-luar).
const DATA_DIR = path.join(dataRoot(), 'ttd');

const SAFE_REL = /^[a-z]+\/[A-Za-z0-9._-]+$/;
const SAFE_NAME = /^[A-Za-z0-9._-]+$/;
const DATA_URL_PREFIX = 'data:image/png;base64,';

export function isDataUrlSignature(value: string): boolean {
	return value.startsWith('data:image/');
}

function safeRelPath(relPath: string): string | null {
	if (!relPath || relPath.includes('..') || relPath.includes('\\')) return null;
	if (!SAFE_REL.test(relPath)) return null;
	return relPath;
}

/**
 * Write a data-URL PNG to data/ttd/<kategori>/<filename>.
 * Returns the relative path to store in the DB.
 */
export async function saveSignatureFile(
	kategori: TtdKategori,
	filename: string,
	dataUrl: string
): Promise<string> {
	if (!SAFE_NAME.test(filename)) {
		throw new Error('Nama file tanda tangan tidak valid.');
	}
	if (!dataUrl.startsWith(DATA_URL_PREFIX)) {
		throw new Error('Format tanda tangan tidak valid.');
	}
	const buf = Buffer.from(dataUrl.slice(DATA_URL_PREFIX.length), 'base64');
	if (!buf.length) {
		throw new Error('Tanda tangan kosong.');
	}
	const dir = path.join(DATA_DIR, kategori);
	await fs.mkdir(dir, { recursive: true });
	await fs.writeFile(path.join(dir, filename), buf);
	return `${kategori}/${filename}`;
}

export async function readSignatureFile(relPath: string): Promise<Buffer | null> {
	const safe = safeRelPath(relPath);
	if (!safe) return null;
	try {
		return await fs.readFile(path.join(DATA_DIR, safe));
	} catch {
		return null;
	}
}

export async function deleteSignatureFile(relPath: string): Promise<void> {
	const safe = safeRelPath(relPath);
	if (!safe) return;
	await fs.rm(path.join(DATA_DIR, safe), { force: true }).catch(() => {});
}

/** Resolve a stored value (rel path or legacy data URL) into a data URL for PDF embedding. */
export async function signatureToDataUrl(value: string | null | undefined): Promise<string | null> {
	if (!value) return null;
	if (isDataUrlSignature(value)) return value;
	const buf = await readSignatureFile(value);
	return buf ? `${DATA_URL_PREFIX}${buf.toString('base64')}` : null;
}

/**
 * Tanda tangan orang (kepala sekolah, wali kelas, guru).
 *
 * Isinya disimpan pada kolom `pegawai.tanda_tangan` di database (PNG data URL)
 * supaya ikut terbawa saat database di-backup atau dipindah ke komputer lain.
 * Berkas lama di `<root>/ttd/pegawai/<id>.png` masih dibaca sebagai cadangan dan
 * dipindahkan otomatis oleh `migratePersonSignaturesToDb()`.
 */
export function personSignatureRelPath(pegawaiId: number): string {
	return `pegawai/${pegawaiId}.png`;
}

/** Simpan tanda tangan pegawai (PNG transparan) ke database. */
export async function savePersonSignature(pegawaiId: number, dataUrl: string): Promise<string> {
	if (!dataUrl.startsWith(DATA_URL_PREFIX)) {
		throw new Error('Format tanda tangan tidak valid.');
	}
	if (!Buffer.from(dataUrl.slice(DATA_URL_PREFIX.length), 'base64').length) {
		throw new Error('Tanda tangan kosong.');
	}

	await db
		.update(tablePegawai)
		.set({ tandaTangan: dataUrl, updatedAt: new Date().toISOString() })
		.where(eq(tablePegawai.id, pegawaiId));

	// Berkas lama (kalau ada) tidak dipakai lagi supaya tidak ada dua sumber.
	await deleteSignatureFile(personSignatureRelPath(pegawaiId));

	return personSignatureRelPath(pegawaiId);
}

/** Hapus tanda tangan pegawai (dipakai saat admin/wali mengosongkan ulang). */
export async function deletePersonSignature(pegawaiId: number): Promise<void> {
	await db
		.update(tablePegawai)
		.set({ tandaTangan: null, updatedAt: new Date().toISOString() })
		.where(eq(tablePegawai.id, pegawaiId));
	await deleteSignatureFile(personSignatureRelPath(pegawaiId));
}

async function readPersonSignature(pegawaiId: number): Promise<string | null> {
	try {
		const row = await db.query.tablePegawai.findFirst({
			columns: { tandaTangan: true },
			where: eq(tablePegawai.id, pegawaiId)
		});
		const stored = row?.tandaTangan?.trim();
		if (stored) return stored;
	} catch {
		// Kolom belum ada (database lama / impor) — pakai berkas cadangan.
	}
	return null;
}

/** Tanda tangan pegawai sebagai data URL (untuk ditampilkan atau ditempel di PDF). */
export async function personSignatureDataUrl(
	pegawaiId: number | null | undefined
): Promise<string | null> {
	if (!pegawaiId) return null;

	const stored = await readPersonSignature(pegawaiId);
	if (stored) return signatureToDataUrl(stored);
	return signatureToDataUrl(personSignatureRelPath(pegawaiId));
}

/** True bila pegawai sudah punya tanda tangan tersimpan. */
export async function hasPersonSignature(pegawaiId: number): Promise<boolean> {
	const stored = await readPersonSignature(pegawaiId);
	if (stored) return true;
	const buf = await readSignatureFile(personSignatureRelPath(pegawaiId));
	return Boolean(buf && buf.length > 0);
}

// One-time move of file-based person signatures into the database.
let personMigrated = false;

export async function migratePersonSignaturesToDb(): Promise<void> {
	if (personMigrated) return;
	personMigrated = true;

	try {
		const files = await fs.readdir(path.join(DATA_DIR, 'pegawai')).catch(() => [] as string[]);
		for (const file of files) {
			const match = /^(\d+)\.png$/.exec(file);
			if (!match) continue;
			const pegawaiId = Number(match[1]);

			const buf = await fs.readFile(path.join(DATA_DIR, 'pegawai', file)).catch(() => null);
			if (!buf?.length) continue;

			const pegawai = await db.query.tablePegawai.findFirst({
				columns: { id: true, tandaTangan: true },
				where: eq(tablePegawai.id, pegawaiId)
			});
			// Pegawai sudah tidak ada: berkas dibiarkan supaya tidak salah hapus.
			if (!pegawai) continue;

			if (!pegawai.tandaTangan?.trim()) {
				await db
					.update(tablePegawai)
					.set({ tandaTangan: `${DATA_URL_PREFIX}${buf.toString('base64')}` })
					.where(eq(tablePegawai.id, pegawaiId));
			}
			await fs.rm(path.join(DATA_DIR, 'pegawai', file), { force: true }).catch(() => {});
		}
	} catch (e) {
		console.warn('[ttd] failed to move person signatures into the database:', e);
	}
}

// One-time migration: move legacy inline data-URL signatures out of the DB into files.
let legacyMigrated = false;

async function tableExists(name: string): Promise<boolean> {
	const result = await db.$client.execute({
		sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
		args: [name]
	});
	return result.rows.length > 0;
}

export async function migrateLegacySignatures(): Promise<void> {
	if (legacyMigrated) return;

	try {
		// Each branch is guarded on table existence: on a fresh install only one of
		// the two tables may exist yet (they are created by separate ensure-* scripts).
		if (await tableExists('presensi_guru')) {
			const guruRows = await db.query.tablePresensiGuru.findMany({
				columns: { id: true, authUserId: true, tanggal: true, tandaTangan: true },
				where: like(tablePresensiGuru.tandaTangan, 'data:image%')
			});
			for (const row of guruRows) {
				if (!row.tandaTangan) continue;
				const rel = await saveSignatureFile(
					'guru',
					`${row.authUserId}_${row.tanggal}.png`,
					row.tandaTangan
				);
				await db
					.update(tablePresensiGuru)
					.set({ tandaTangan: rel })
					.where(eq(tablePresensiGuru.id, row.id));
			}
		}

		if (await tableExists('buku_tamu')) {
			const tamuRows = await db.query.tableBukuTamu.findMany({
				columns: { id: true, tandaTangan: true },
				where: like(tableBukuTamu.tandaTangan, 'data:image%')
			});
			for (const row of tamuRows) {
				if (!row.tandaTangan) continue;
				const rel = await saveSignatureFile('tamu', `tamu_${row.id}.png`, row.tandaTangan);
				await db
					.update(tableBukuTamu)
					.set({ tandaTangan: rel })
					.where(eq(tableBukuTamu.id, row.id));
			}
		}
	} catch (e) {
		console.warn('[ttd] failed to migrate legacy signatures:', e);
		return;
	}

	legacyMigrated = true;
}
