import { json } from '@sveltejs/kit';
import { getUpdateOverview } from '$lib/server/update-auto';
import { isAuthorizedUser } from '../../../pengguna/permissions';

// require permission 'app_check_update' to view update state
const REQUIRED_PERMISSION: UserPermission = 'app_check_update';

export const GET = async ({ locals }) => {
	if (!isAuthorizedUser([REQUIRED_PERMISSION], locals.user)) {
		return json(
			{ message: 'Anda tidak memiliki izin untuk memeriksa pembaruan.' },
			{ status: 403 }
		);
	}

	try {
		return json(await getUpdateOverview());
	} catch (error) {
		console.error('[updates] gagal membaca status pembaruan', error);
		return json({ message: 'Gagal membaca status pembaruan.' }, { status: 500 });
	}
};
