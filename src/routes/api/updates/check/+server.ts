import { json } from '@sveltejs/kit';
import { runUpdateCheck, getUpdateOverview } from '$lib/server/update-auto';
import { isAuthorizedUser } from '../../../pengguna/permissions';

// require permission 'app_check_update' to trigger update checks
const REQUIRED_PERMISSION: UserPermission = 'app_check_update';

export const POST = async ({ locals }) => {
	if (!isAuthorizedUser([REQUIRED_PERMISSION], locals.user)) {
		return json(
			{ message: 'Anda tidak memiliki izin untuk memeriksa pembaruan.' },
			{ status: 403 }
		);
	}

	try {
		const result = await runUpdateCheck({ force: true });
		const overview = await getUpdateOverview();

		if (!result.ok) {
			return json(
				{ ...overview, message: result.error ?? 'Gagal memeriksa pembaruan.' },
				{ status: 502 }
			);
		}

		return json({ ...overview, latest: result.latest ?? null });
	} catch (error) {
		console.error('[updates] pemeriksaan paksa gagal', error);
		return json(
			{ message: error instanceof Error ? error.message : 'Gagal memeriksa pembaruan.' },
			{ status: 500 }
		);
	}
};
