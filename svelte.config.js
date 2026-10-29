import adapterNode from '@sveltejs/adapter-node';
import adapterVercel from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { mdsvex } from 'mdsvex';

/**
 * Dual adapter:
 *  - Default: `@sveltejs/adapter-node` → `build/index.js`, dipakai `pnpm start`
 *    dan pipeline Windows installer (jangan diubah).
 *  - Vercel: dipilih otomatis saat `VERCEL=1` (diset oleh build environment
 *    Vercel), atau paksa lokal dengan `ADAPTER=vercel pnpm build`.
 */
const useVercel = process.env.VERCEL === '1' || process.env.ADAPTER === 'vercel';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: [mdsvex({ extensions: ['.md'] }), vitePreprocess()],
	kit: {
		adapter: useVercel
			? adapterVercel({
					// Node runtime (butuh fs/child_process untuk puppeteer-core);
					// nodejs22.x tersedia di semua plan Vercel.
					runtime: 'nodejs22.x',
					// Render PDF (PagedJS + Chromium) bisa makan waktu; 60s aman
					// untuk Hobby, naikkan di Pro bila perlu.
					maxDuration: 60
				})
			: adapterNode(),
		// NOTE: `kit.csrf.checkOrigin` was deprecated in favour of the
		// `csrf.trustedOrigins` config. We intentionally disable the built-in
		// same-origin guard so the runtime-aware check in `src/hooks.server.ts`
		// can run. Providing a function that returns true for any origin
		// effectively disables the built-in guard (equivalent to
		// `checkOrigin: false`).
		// Disable built-in same-origin guard (preserve previous behavior).
		csrf: {
			// allow all origins so SvelteKit's built-in check doesn't block requests
			// and our custom `csrfGuard` in `hooks.server.ts` can enforce policy.
			// NOTE: SvelteKit expects an array; using ['*'] disables the built-in
			// origin check (equivalent to checkOrigin: false).
			trustedOrigins: ['*']
		}
	},

	extensions: ['.svelte', '.md']
};

export default config;
