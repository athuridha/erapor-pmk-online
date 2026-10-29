/// <reference types="vite/client" />

// Virtual module dari pagedjsPolyfillPlugin() di vite.config.ts:
// isi dist/paged.polyfill.js (pagedjs) sebagai string, di-inline saat build.
declare module 'virtual:pagedjs-polyfill' {
	const source: string;
	export default source;
}