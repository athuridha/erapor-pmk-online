import { json } from '@sveltejs/kit';
import { getUpdateOverview, saveAutoUpdateSettings } from '$lib/server/update-auto';
import { isAdminUser } from '../../../pengguna/permissions';

/**
 * Simpan pengaturan auto update. Hanya admin/kepala sekolah: auto-install
 * menghentikan & memulai ulang aplikasi, jadi tidak boleh bisa diubah akun biasa.
 */
export const POST = async ({ request, locals }) => {
	if (!isAdminUser(locals.user)) {
		return json(
			{ message: 'Hanya admin atau kepala sekolah yang dapat mengubah pengaturan pembaruan.' },
			{ status: 403 }
		);
	}

	let payload: Record<string, unknown>;
	try {
		payload = await request.json();
	} catch {
		return json({ message: 'Format permintaan tidak dikenali.' }, { status: 400 });
	}

	try {
		await saveAutoUpdateSettings({
			enabled: payload.enabled as boolean | undefined,
			autoDownload: payload.autoDownload as boolean | undefined,
			autoInstall: payload.autoInstall as boolean | undefined,
			intervalMinutes: payload.intervalMinutes as number | undefined,
			idleMinutes: payload.idleMinutes as number | undefined,
			windowStartHour: payload.windowStartHour as number | undefined,
			windowEndHour: payload.windowEndHour as number | undefined
		});

		return json(await getUpdateOverview());
	} catch (error) {
		console.error('[updates] gagal menyimpan pengaturan auto update', error);
		return json(
			{
				message: error instanceof Error ? error.message : 'Gagal menyimpan pengaturan pembaruan.'
			},
			{ status: 500 }
		);
	}
};
