import tailwindcss from '@tailwindcss/vite';
import devtoolsJson from 'vite-plugin-devtools-json';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type Plugin } from 'vite';
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const VIRTUAL_POLYFILL = 'virtual:pagedjs-polyfill';
const RESOLVED_VIRTUAL_POLYFILL = `\0${VIRTUAL_POLYFILL}`;

/**
 * Polyfill PagedJS (pagedjs-cli/dist/browser.js membungkus
 * pagedjs/dist/paged.polyfill.js) di-inline sebagai string pada build time.
 * Virtual module supaya isi file tidak perlu di-resolve di runtime —
 * penting untuk serverless Vercel (node_modules pnpm tidak hoisted dan
 * export map `pagedjs` tidak punya subpath `/polyfill`).
 */
function pagedjsPolyfillPlugin(): Plugin {
	const req = createRequire(import.meta.url);
	let cachedSource: string | null = null;
	return {
		name: 'pagedjs-polyfill',
		resolveId(id) {
			if (id === VIRTUAL_POLYFILL) return RESOLVED_VIRTUAL_POLYFILL;
			return null;
		},
		load(id) {
			if (id !== RESOLVED_VIRTUAL_POLYFILL) return null;
			if (cachedSource === null) {
				// Cari dist/paged.polyfill.js dari entry pagedjs (kandidat berjalan
				// naik dari folder entry, tahan-terhadap struktur pnpm/hoisted).
				let dir = dirname(req.resolve('pagedjs'));
				let polyfillPath: string | null = null;
				for (let i = 0; i < 5; i++) {
					const candidate = join(dir, 'dist', 'paged.polyfill.js');
					if (existsSync(candidate)) {
						polyfillPath = candidate;
						break;
					}
					dir = dirname(dir);
				}
				if (!polyfillPath) {
					throw new Error(
						'pagedjs-polyfill: dist/paged.polyfill.js tidak ditemukan di sekitar '
							+ `entry pagedjs (${req.resolve('pagedjs')})`
					);
				}
				cachedSource = readFileSync(polyfillPath, 'utf-8');
			}
			return `export default ${JSON.stringify(cachedSource)};`;
		}
	};
}

export default defineConfig(({ mode }) => {
	const isProd = mode === 'production';

	return {
		plugins: [tailwindcss(), sveltekit(), devtoolsJson(), pagedjsPolyfillPlugin()],
		build: {
			minify: isProd ? 'esbuild' : false,
			cssMinify: isProd
		},
		esbuild: isProd
			? {
					drop: ['debugger']
				}
			: undefined
	};
});
