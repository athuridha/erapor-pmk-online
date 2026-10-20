import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import db from '$lib/server/db';
import { tableMurid, tableMuridLampiran } from '$lib/server/db/schema';
import { arsipDir } from '$lib/server/data-dirs';
import { isAuthorizedUser } from '../../../pengguna/permissions';

const JENIS = new Set(['kk', 'akta', 'ijazah_terakhir', 'ijazah_sekolah']);
const MAX_BYTES = 4 * 1024 * 1024;

type Jenis = 'kk' | 'akta' | 'ijazah_terakhir' | 'ijazah_sekolah';

type Lokasi = {
	muridId: number;
	sekolahId: number;
	status: string;
};

function canManage(user: App.Locals['user']) {
	return !!user && isAuthorizedUser(['informasi_umum_murid'], user);
}

function fail(status: number, message: string) {
	return json({ message }, { status });
}

function detectFileType(buffer: Buffer): { mime: string; ext: string } | null {
	if (buffer.length >= 4 && buffer.subarray(0, 4).toString('latin1') === '%PDF') {
		return { mime: 'application/pdf', ext: '.pdf' };
	}
	if (
		buffer.length >= 8 &&
		buffer[0] === 0x89 &&
		buffer[1] === 0x50 &&
		buffer[2] === 0x4e &&
		buffer[3] === 0x47 &&
		buffer[4] === 0x0d &&
		buffer[5] === 0x0a &&
		buffer[6] === 0x1a &&
		buffer[7] === 0x0a
	) {
		return { mime: 'image/png', ext: '.png' };
	}
	if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
		return { mime: 'image/jpeg', ext: '.jpg' };
	}
	return null;
}

function sanitizeFileName(name: string, ext: string) {
	const base = path
		.basename(name, path.extname(name))
		.normalize('NFKD')
		.replace(/[^\p{L}\p{N}\s._-]/gu, '')
		.trim()
		.replace(/\s+/g, '-')
		.slice(0, 90);
	return `${base || 'arsip'}${ext}`;
}

function safeContentDisposition(name: string, download: boolean) {
	const cleaned = name.replace(/[\r\n"]/g, '').trim() || 'arsip';
	const ascii = cleaned.replace(/[^\x20-\x7e]/g, '_');
	const encoded = encodeURIComponent(cleaned);
	return `${download ? 'attachment' : 'inline'}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

async function getMurid(id: number): Promise<Lokasi | null> {
	if (!Number.isInteger(id) || id <= 0) return null;
	const murid = await db.query.tableMurid.findFirst({
		columns: { id: true, sekolahId: true, status: true },
		where: eq(tableMurid.id, id)
	});
	return murid ? { muridId: murid.id, sekolahId: murid.sekolahId, status: murid.status } : null;
}

function ownedByActiveSchool(murid: Lokasi | null, locals: App.Locals) {
	return !!murid && !!locals.sekolah?.id && murid.sekolahId === locals.sekolah.id;
}

export async function GET({
	params,
	url,
	locals
}: {
	params: Record<string, string>;
	url: URL;
	locals: App.Locals;
}) {
	if (!locals.user) return fail(401, 'Silakan masuk terlebih dahulu.');
	if (!canManage(locals.user)) return fail(403, 'Tidak memiliki akses ke arsip murid.');

	const muridId = Number(params.id);
	const jenis = url.searchParams.get('jenis') ?? '';
	if (!JENIS.has(jenis)) return fail(400, 'Jenis arsip tidak valid.');

	const murid = await getMurid(muridId);
	if (!ownedByActiveSchool(murid, locals)) return fail(404, 'Murid tidak ditemukan.');

	const row = await db.query.tableMuridLampiran.findFirst({
		where: and(
			eq(tableMuridLampiran.muridId, muridId),
			eq(tableMuridLampiran.jenis, jenis as Jenis)
		)
	});
	if (!row) return fail(404, 'Arsip belum diunggah.');

	const base = path.resolve(arsipDir());
	const fullPath = path.resolve(base, row.filePath);
	if (!fullPath.startsWith(base + path.sep)) return fail(404, 'Berkas tidak ditemukan.');

	try {
		const data = await fs.readFile(fullPath);
		return new Response(new Uint8Array(data), {
			headers: {
				'Content-Type': row.mimeType,
				'Content-Length': String(data.length),
				'Content-Disposition': safeContentDisposition(
					row.namaFile,
					url.searchParams.get('download') === '1'
				),
				'Cache-Control': 'private, no-store'
			}
		});
	} catch {
		return fail(404, 'Berkas tidak ditemukan.');
	}
}

export async function POST({
	params,
	request,
	locals
}: {
	params: Record<string, string>;
	request: Request;
	locals: App.Locals;
}) {
	if (!locals.user) return fail(401, 'Silakan masuk terlebih dahulu.');
	if (!canManage(locals.user)) return fail(403, 'Tidak memiliki akses ke arsip murid.');

	const muridId = Number(params.id);
	const murid = await getMurid(muridId);
	if (!ownedByActiveSchool(murid, locals) || !murid) return fail(404, 'Murid tidak ditemukan.');

	const form = await request.formData();
	const jenis = String(form.get('jenis') ?? '');
	if (!JENIS.has(jenis)) return fail(400, 'Jenis arsip tidak valid.');
	if (jenis === 'ijazah_sekolah' && murid.status !== 'lulus') {
		return fail(400, 'Ijazah sekolah hanya dapat diunggah untuk murid berstatus lulus.');
	}

	const file = form.get('berkas');
	if (!(file instanceof File) || file.size === 0)
		return fail(400, 'Pilih berkas yang akan diunggah.');
	if (file.size > MAX_BYTES) return fail(400, 'Ukuran berkas maksimal 4MB.');

	const buffer = Buffer.from(await file.arrayBuffer());
	const detected = detectFileType(buffer);
	if (!detected) return fail(400, 'Format berkas harus PDF, JPG, atau PNG.');

	const dir = path.join(arsipDir(), `murid-${muridId}`);
	await fs.mkdir(dir, { recursive: true });
	const filename = `${jenis}-${Date.now()}-${randomUUID().slice(0, 8)}${detected.ext}`;
	const relPath = path.posix.join(`murid-${muridId}`, filename);
	const fullPath = path.join(dir, filename);
	const displayName = sanitizeFileName(file.name || `arsip-${jenis}`, detected.ext);

	const existing = await db.query.tableMuridLampiran.findFirst({
		where: and(
			eq(tableMuridLampiran.muridId, muridId),
			eq(tableMuridLampiran.jenis, jenis as Jenis)
		)
	});

	await fs.writeFile(fullPath, buffer, { mode: 0o644 });

	try {
		const now = new Date().toISOString();
		if (existing) {
			await db
				.update(tableMuridLampiran)
				.set({
					namaFile: displayName,
					filePath: relPath,
					mimeType: detected.mime,
					ukuran: file.size,
					updatedAt: now
				})
				.where(eq(tableMuridLampiran.id, existing.id));
		} else {
			await db.insert(tableMuridLampiran).values({
				muridId,
				jenis: jenis as Jenis,
				namaFile: displayName,
				filePath: relPath,
				mimeType: detected.mime,
				ukuran: file.size,
				createdAt: now,
				updatedAt: now
			});
		}
	} catch (error) {
		console.error('[murid-arsip] gagal menyimpan metadata', error);
		await fs.unlink(fullPath).catch(() => undefined);
		return fail(500, 'Gagal menyimpan arsip.');
	}

	if (existing && existing.filePath !== relPath) {
		await fs.unlink(path.resolve(arsipDir(), existing.filePath)).catch(() => undefined);
	}

	return json({
		message: 'Arsip berhasil disimpan.',
		lampiran: {
			jenis,
			namaFile: displayName,
			mimeType: detected.mime,
			ukuran: file.size
		}
	});
}

export async function DELETE({
	params,
	url,
	locals
}: {
	params: Record<string, string>;
	url: URL;
	locals: App.Locals;
}) {
	if (!locals.user) return fail(401, 'Silakan masuk terlebih dahulu.');
	if (!canManage(locals.user)) return fail(403, 'Tidak memiliki akses ke arsip murid.');

	const muridId = Number(params.id);
	const jenis = url.searchParams.get('jenis') ?? '';
	if (!JENIS.has(jenis)) return fail(400, 'Jenis arsip tidak valid.');

	const murid = await getMurid(muridId);
	if (!ownedByActiveSchool(murid, locals)) return fail(404, 'Murid tidak ditemukan.');

	const row = await db.query.tableMuridLampiran.findFirst({
		where: and(
			eq(tableMuridLampiran.muridId, muridId),
			eq(tableMuridLampiran.jenis, jenis as Jenis)
		)
	});
	if (!row) return fail(404, 'Arsip tidak ditemukan.');

	await db
		.delete(tableMuridLampiran)
		.where(
			and(eq(tableMuridLampiran.muridId, muridId), eq(tableMuridLampiran.jenis, jenis as Jenis))
		);
	await fs.unlink(path.resolve(arsipDir(), row.filePath)).catch(() => undefined);

	return json({ message: 'Arsip berhasil dihapus.' });
}
