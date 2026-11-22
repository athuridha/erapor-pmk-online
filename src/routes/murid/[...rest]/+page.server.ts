import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** URL lama digabung ke Master Data. */
export const load: PageServerLoad = ({ params }) => {
	const rest = params.rest ? `/${params.rest}` : '';
	throw redirect(308, `/master-data/murid${rest}`);
};
