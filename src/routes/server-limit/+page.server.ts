import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const isServerLimitActive = process.env.SERVER_LIMIT_ENABLED === 'true';
	if (!isServerLimitActive) {
		throw redirect(303, '/');
	}
	return {
		meta: {
			title: '500 - OOPS! Server Error | Server Telah Melebihi Batas Limit'
		},
		host: url.host,
		timestamp: new Date().toISOString()
	};
};
