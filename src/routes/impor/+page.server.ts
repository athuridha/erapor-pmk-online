import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const meta: PageMeta = {
		title: 'Pusat Impor',
		description:
			'Satu pintu untuk seluruh alur impor data: nilai, data pokok, akun guru, perangkat pembelajaran, dan JSON RPM.'
	};
	return { meta };
};
