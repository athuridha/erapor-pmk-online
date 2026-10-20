import { and, desc, eq } from 'drizzle-orm';
import db from '$lib/server/db';
import { tableAuditLog } from '$lib/server/db/schema';

export interface CatatanAudit {
	sekolahId: number;
	userId?: number | null;
	aktor?: string | null;
	aksi: string;
	entitas: string;
	entitasId?: number | null;
	ringkasan?: string | null;
	detail?: Record<string, unknown> | null;
}

/**
 * Catat jejak audit. Sengaja tidak melempar error: kegagalan menulis audit
 * tidak boleh membatalkan transaksi bisnis.
 */
export async function catatAudit(catatan: CatatanAudit): Promise<void> {
	try {
		await db.insert(tableAuditLog).values({
			sekolahId: catatan.sekolahId,
			userId: catatan.userId ?? null,
			aktor: catatan.aktor ?? null,
			aksi: catatan.aksi,
			entitas: catatan.entitas,
			entitasId: catatan.entitasId ?? null,
			ringkasan: catatan.ringkasan ?? null,
			detail: catatan.detail ?? null,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		});
	} catch (error) {
		console.warn('[audit] gagal menulis jejak audit:', error);
	}
}

/** Daftar jejak audit terbaru untuk sekolah (dipakai halaman audit). */
export async function loadAuditLog(
	sekolahId: number,
	opsi: { limit?: number; aksi?: string | null } = {}
) {
	const batas = Math.min(opsi.limit ?? 100, 500);
	return db
		.select({
			id: tableAuditLog.id,
			aksi: tableAuditLog.aksi,
			entitas: tableAuditLog.entitas,
			entitasId: tableAuditLog.entitasId,
			ringkasan: tableAuditLog.ringkasan,
			detail: tableAuditLog.detail,
			aktor: tableAuditLog.aktor,
			createdAt: tableAuditLog.createdAt
		})
		.from(tableAuditLog)
		.where(
			opsi.aksi
				? and(eq(tableAuditLog.sekolahId, sekolahId), eq(tableAuditLog.aksi, opsi.aksi))
				: eq(tableAuditLog.sekolahId, sekolahId)
		)
		.orderBy(desc(tableAuditLog.id))
		.limit(batas);
}
