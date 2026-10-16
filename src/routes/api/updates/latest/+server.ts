import { json } from '@sveltejs/kit';
import { compareVersions, fetchLatestRelease, getAppVersion } from '$lib/server/update-manager';
import { isAuthorizedUser } from '../../../pengguna/permissions';

// require permission 'app_check_update' to use update APIs
const REQUIRED_PERMISSION: UserPermission = 'app_check_update';

export const GET = async ({ locals }) => {
	if (!isAuthorizedUser([REQUIRED_PERMISSION], locals.user)) {
		return json(
			{ message: 'Anda tidak memiliki izin untuk memeriksa pembaruan.' },
			{ status: 403 }
		);
	}

	const currentVersion = getAppVersion();
	try {
		const latest = await fetchLatestRelease();
		return json({
			currentVersion,
			updateAvailable: compareVersions(latest.version, currentVersion) > 0,
			latest
		});
	} catch (error) {
		console.error('Failed to fetch latest e-Rapor release', error);
		return json(
			{
				currentVersion,
				updateAvailable: false,
				latest: null,
				message: 'Gagal memeriksa pembaruan dari GitHub.'
			},
			{ status: 502 }
		);
	}
};
