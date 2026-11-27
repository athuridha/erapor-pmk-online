import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';
import { isFullAdmin } from '../pengguna/permissions';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!dev || !isFullAdmin(locals.user)) {
		throw error(404, 'Halaman tidak ditemukan.');
	}
	// Simulasi error tak terduga — ini akan melempar Error dan harus memicu +error.svelte
	throw new Error('yahooo!!');
};
