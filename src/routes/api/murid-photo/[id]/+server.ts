import fs from 'node:fs/promises';
import path from 'node:path';
import { error } from '@sveltejs/kit';
import db from '$lib/server/db/index.js';
import { tableMurid } from '$lib/server/db/schema.js';
import { uploadsDir } from '$lib/server/data-dirs';
import { and, eq } from 'drizzle-orm';

function contentTypeFor(filename: string) {
	if (filename.endsWith('.png')) return 'image/png';
	return 'image/jpeg';
}

function slugifyName(name: string) {
	if (!name) return 'murid';
	const cleaned = name
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^\p{L}\p{N}\s-]/gu, '')
		.trim()
		.replace(/\s+/g, '-')
		.toLowerCase();
	return cleaned.substring(0, 80) || 'murid';
}

async function generateUniqueFilename(
	dbInstance: typeof db,
	base: string,
	ext: string,
	dir: string
) {
	let filename = `${base}${ext}`;
	let counter = 1;

	do {
		try {
			await fs.access(path.join(dir, filename));
			filename = `${base}-${counter}${ext}`;
			counter++;
		} catch {
			break;
		}
	} while (counter < 1000);

	return filename;
}

export async function GET({
	params,
	locals
}: {
	params: Record<string, string>;
	locals: App.Locals;
}) {
	const id = +params.id;
	if (!id) throw error(400, 'Invalid id');

	const sekolahId = locals.sekolah?.id;
	if (!sekolahId) throw error(401, 'Unauthorized');

	const murid = await db.query.tableMurid.findFirst({
		where: and(eq(tableMurid.id, id), eq(tableMurid.sekolahId, sekolahId)),
		columns: { foto: true }
	});
	if (!murid || !murid.foto) throw error(404, 'Not found');

	const dir = path.resolve(uploadsDir());
	const filePath = path.resolve(dir, murid.foto);
	// Containment check: prevent path traversal if murid.foto contains '../'
	if (!filePath.startsWith(dir + path.sep)) throw error(403, 'Invalid path');

	try {
		const data = await fs.readFile(filePath);
		return new Response(Buffer.from(data), {
			headers: { 'Content-Type': contentTypeFor(murid.foto) }
		});
	} catch {
		throw error(404, 'Not found');
	}
}

export async function DELETE({
	params,
	locals
}: {
	params: Record<string, string>;
	locals: App.Locals;
}) {
	const id = +params.id;
	if (!id) return new Response(JSON.stringify({ message: 'Invalid id' }), { status: 400 });

	const murid = await db.query.tableMurid.findFirst({
		where: eq(tableMurid.id, id),
		columns: { foto: true, sekolahId: true }
	});
	if (!murid) return new Response(JSON.stringify({ message: 'Not found' }), { status: 404 });

	// ensure sekolah ownership
	const sekolahId = locals.sekolah?.id;
	if (!sekolahId || murid.sekolahId !== sekolahId)
		return new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 });

	const dir = uploadsDir();
	if (murid.foto) {
		try {
			const resolvedPath = path.resolve(dir, murid.foto);
			if (!resolvedPath.startsWith(path.resolve(dir) + path.sep)) {
				return new Response(JSON.stringify({ message: 'Invalid path' }), { status: 403 });
			}
			await fs.unlink(resolvedPath);
		} catch {
			// ignore
		}
		await db.update(tableMurid).set({ foto: null }).where(eq(tableMurid.id, id));
	}
	return new Response(JSON.stringify({ message: 'OK' }), {
		headers: { 'Content-Type': 'application/json' }
	});
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
	const id = +params.id;
	if (!id) return new Response(JSON.stringify({ message: 'Invalid id' }), { status: 400 });

	const murid = await db.query.tableMurid.findFirst({
		where: eq(tableMurid.id, id),
		columns: { id: true, nama: true, foto: true, sekolahId: true }
	});
	if (!murid) return new Response(JSON.stringify({ message: 'Murid not found' }), { status: 404 });

	// ensure sekolah ownership
	const sekolahId = locals.sekolah?.id;
	if (!sekolahId || murid.sekolahId !== sekolahId)
		return new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 });

	const formData = await request.formData();
	const uploadedFile = formData.get('foto') as File | null;

	if (!uploadedFile || uploadedFile.size === 0) {
		return new Response(JSON.stringify({ message: 'No file provided' }), { status: 400 });
	}

	const allowed = ['image/png', 'image/jpeg'];
	if (!allowed.includes(uploadedFile.type)) {
		return new Response(
			JSON.stringify({ message: 'Format file tidak didukung; hanya JPG dan PNG yang diizinkan' }),
			{ status: 400 }
		);
	}

	if (uploadedFile.size > 500 * 1024) {
		return new Response(
			JSON.stringify({ message: 'Ukuran file foto tidak boleh lebih dari 500KB' }),
			{ status: 400 }
		);
	}

	try {
		const buffer = Buffer.from(await uploadedFile.arrayBuffer());
		const dir = uploadsDir();
		await fs.mkdir(dir, { recursive: true });

		const ext = uploadedFile.type === 'image/png' ? '.png' : '.jpg';
		const base = slugifyName(murid.nama || `murid-${murid.id}`);
		const filename = await generateUniqueFilename(db, base, ext, dir);
		const filePath = path.join(dir, filename);

		// Remove old file if exists and different
		if (murid.foto && murid.foto !== filename) {
			try {
				const resolvedPath = path.resolve(dir, murid.foto);
				if (!resolvedPath.startsWith(path.resolve(dir) + path.sep)) {
					return new Response(JSON.stringify({ message: 'Invalid path' }), { status: 403 });
				}
				await fs.unlink(resolvedPath);
			} catch {
				// ignore
			}
		}

		await fs.writeFile(filePath, buffer, { mode: 0o644 });
		await db.update(tableMurid).set({ foto: filename }).where(eq(tableMurid.id, id));

		return new Response(JSON.stringify({ foto: filename, message: 'Foto berhasil diperbarui' }), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (err) {
		console.error('Upload error:', err);
		return new Response(JSON.stringify({ message: 'Gagal upload foto' }), { status: 500 });
	}
}
