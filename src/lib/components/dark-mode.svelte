<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from './icon.svelte';

	const STORAGE_KEY = 'dark-mode';
	const LIGHT_THEME = 'emerald';
	const DARK_THEME = 'dark';

	let isDark = $state(false);
	let hasStoredPreference = $state(false);
	let mediaQuery: MediaQueryList | null = null;

	function resolveStoredTheme(raw: string | null) {
		if (!raw) return null;
		if (raw === DARK_THEME || raw === LIGHT_THEME) return raw;
		if (raw === 'light') return LIGHT_THEME;
		if (raw === 'true' || raw === 'false') {
			return raw === 'true' ? DARK_THEME : LIGHT_THEME;
		}
		return null;
	}

	function applyTheme(theme: string, persist: boolean) {
		document.documentElement.setAttribute('data-theme', theme);
		if (persist) {
			localStorage.setItem(STORAGE_KEY, theme);
		} else if (!hasStoredPreference) {
			localStorage.removeItem(STORAGE_KEY);
		}
	}

	function handleSystemChange(event: MediaQueryListEvent) {
		if (hasStoredPreference) return;
		const theme = event.matches ? DARK_THEME : LIGHT_THEME;
		isDark = theme === DARK_THEME;
		applyTheme(theme, false);
	}

	function toggleTheme() {
		isDark = !isDark;
		hasStoredPreference = true;
		applyTheme(isDark ? DARK_THEME : LIGHT_THEME, true);
	}

	onMount(() => {
		const storedTheme = resolveStoredTheme(localStorage.getItem(STORAGE_KEY));
		if (storedTheme) {
			hasStoredPreference = true;
			isDark = storedTheme === DARK_THEME;
		} else {
			mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
			isDark = mediaQuery.matches;
			mediaQuery.addEventListener('change', handleSystemChange);
		}
		applyTheme(isDark ? DARK_THEME : LIGHT_THEME, hasStoredPreference);
		return () => {
			mediaQuery?.removeEventListener('change', handleSystemChange);
		};
	});
</script>

<button
	type="button"
	onclick={toggleTheme}
	aria-pressed={isDark}
	title={isDark ? 'Beralih ke mode terang' : 'Beralih ke mode gelap'}
	aria-label={isDark ? 'Beralih ke mode terang' : 'Beralih ke mode gelap'}
	class="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 sm:h-9 sm:w-9 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
>
	<span aria-hidden="true">
		<Icon name={isDark ? 'sun' : 'moon'} class="h-4 w-4" />
	</span>
</button>
