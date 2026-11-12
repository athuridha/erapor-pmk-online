import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	return {
		meta: {
			title: '508 Resource Limit Reached - Please Upgrade'
		},
		host: url.host,
		timestamp: new Date().toISOString()
	};
};
