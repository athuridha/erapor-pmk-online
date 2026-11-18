<script lang="ts">
	let { name, class: classes }: { name: IconName; class?: string } = $props();

	const iconModules = {
		...import.meta.glob('../icons/*.svg', {
			query: '?raw',
			eager: true
		}),
		...import.meta.glob('/src/lib/icons/*.svg', {
			query: '?raw',
			eager: true
		})
	} as Record<string, { default: string }>;

	const iconMap = (() => {
		const map = {} as Record<IconName, string | undefined>;
		for (const [path, mod] of Object.entries(iconModules)) {
			const normalized = path.replace(/\\/g, '/');
			const match = normalized.match(/([^/]+)\.svg$/);
			if (match) {
				map[match[1] as IconName] = mod.default;
			}
		}
		return map;
	})();

	const renderedIcon = $derived.by(() => {
		const raw = iconMap[name];
		if (!raw) return null;
		if (!classes) return raw;
		if (/<svg\b[^>]*\bclass=/.test(raw)) {
			return raw.replace(/(<svg\b[^>]*\bclass=")([^"]*)"/, `$1${classes} $2"`);
		}
		return raw.replace('<svg', `<svg class="${classes}"`);
	});
</script>

{#if renderedIcon}
	{@html renderedIcon}
{:else}
	<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="h-3.5 w-3.5"> </svg>
{/if}
