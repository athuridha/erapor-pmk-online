<script lang="ts" module>
	type ToastInstance = Toast & { id: string; _timer?: ReturnType<typeof setTimeout> };

	export const toasts = $state<ToastInstance[]>([]);

	let seed = 0;

	function nextId(requested?: string): string {
		if (requested) {
			const exists = toasts.some((item) => item.id === requested);
			if (!exists) return requested;
		}
		seed = (seed + 1) % Number.MAX_SAFE_INTEGER;
		return `toast-${Date.now()}-${seed.toString(36)}`;
	}

	export function toast(data: Toast | string, type?: Toast['type']) {
		const payload: Toast =
			typeof data === 'string' ? { message: data, type } : { ...data, type: data.type ?? type };

		const id = nextId(payload.id);
		const entry: ToastInstance = {
			...payload,
			id,
			type: payload.type ?? 'info'
		};

		toasts.push(entry);
		return id;
	}

	export function dismissToast(id: string) {
		const targetIndex = toasts.findIndex((item) => item.id === id);
		if (targetIndex > -1) {
			const item = toasts[targetIndex];
			if (item._timer) clearTimeout(item._timer);
			toasts.splice(targetIndex, 1);
		}
	}
</script>

<script lang="ts">
	import { flip } from 'svelte/animate';
	import { fly } from 'svelte/transition';
	import Icon from './icon.svelte';

	const autoCloseAfter = 3; // seconds
	const typesMaps: Record<
		NonNullable<Toast['type']>,
		{
			cardClass: string;
			barClass: string;
			icon: IconName;
			iconBoxClass: string;
		}
	> = {
		info: {
			cardClass: 'border-blue-200/90 dark:border-blue-800/70',
			barClass: 'bg-blue-600 dark:bg-blue-400',
			icon: 'info',
			iconBoxClass:
				'bg-blue-50 text-blue-600 ring-1 ring-inset ring-blue-200/75 dark:bg-blue-950/60 dark:text-blue-400 dark:ring-blue-800/60'
		},
		success: {
			cardClass: 'border-emerald-200/90 dark:border-emerald-800/70',
			barClass: 'bg-emerald-500 dark:bg-emerald-400',
			icon: 'success',
			iconBoxClass:
				'bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-200/75 dark:bg-emerald-950/60 dark:text-emerald-400 dark:ring-emerald-800/60'
		},
		warning: {
			cardClass: 'border-amber-200/90 dark:border-amber-800/70',
			barClass: 'bg-amber-500 dark:bg-amber-400',
			icon: 'warning',
			iconBoxClass:
				'bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-200/75 dark:bg-amber-950/60 dark:text-amber-400 dark:ring-amber-800/60'
		},
		error: {
			cardClass: 'border-red-200/90 dark:border-red-800/70',
			barClass: 'bg-red-500 dark:bg-red-400',
			icon: 'error',
			iconBoxClass:
				'bg-red-50 text-red-600 ring-1 ring-inset ring-red-200/75 dark:bg-red-950/60 dark:text-red-400 dark:ring-red-800/60'
		}
	};

	function close(id: string) {
		dismissToast(id);
	}

	$effect(() => {
		for (const t of toasts) {
			if (t._timer || t.persist) continue;
			t._timer = setTimeout(() => close(t.id), autoCloseAfter * 1000);
		}
	});
</script>

{#if toasts.length > 0}
	<div
		class="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2.5 px-4 sm:top-5"
		aria-live="polite"
		aria-atomic="false"
	>
		{#each toasts as t (t.id)}
			{@const config = typesMaps[t.type || 'info']}
			<div
				animate:flip={{ duration: 200, delay: 40 }}
				transition:fly={{ y: -12, duration: 180 }}
				class="pointer-events-auto relative flex w-full max-w-md items-center gap-3 rounded-2xl border bg-white/95 py-2.5 pr-2.5 pl-3 text-slate-900 shadow-[0_14px_34px_-10px_rgba(15,23,42,0.16),0_2px_8px_-2px_rgba(15,23,42,0.06)] backdrop-blur-md dark:bg-zinc-900/95 dark:text-zinc-100 dark:shadow-[0_16px_38px_-8px_rgba(0,0,0,0.65)] {config.cardClass}"
				role="alert"
			>
				<span class="w-1 shrink-0 self-stretch rounded-full {config.barClass}" aria-hidden="true"
				></span>
				<span
					class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl {config.iconBoxClass}"
					aria-hidden="true"
				>
					<Icon name={config.icon} class="h-4 w-4" />
				</span>
				<div
					class="min-w-0 flex-1 py-0.5 text-xs leading-snug font-medium text-slate-800 dark:text-zinc-100"
				>
					{@html t.message.replaceAll('\n', '<br />')}
				</div>
				<button
					class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
					type="button"
					title="Tutup"
					onclick={() => close(t.id)}
				>
					<Icon name="close" class="h-3.5 w-3.5" />
					<span class="sr-only">Tutup</span>
				</button>
			</div>
		{/each}
	</div>
{/if}
