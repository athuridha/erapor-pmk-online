<script lang="ts">
	import { browser } from '$app/environment';
	import Icon from '$lib/components/icon.svelte';
	import { toast } from '$lib/components/toast.svelte';
	import { onMount } from 'svelte';

	let {
		currentVersion,
		addresses,
		protocol,
		isAdmin
	}: {
		currentVersion: string;
		addresses: string[];
		protocol: string;
		isAdmin: boolean;
	} = $props();

	// svelte-ignore state_referenced_locally
	let appAddress = $state(addresses[0] ?? '');
	let copying = $state(false);

	onMount(() => {
		if (!appAddress && browser) {
			appAddress = window.location.host;
		}
	});

	async function copyAddress() {
		if (!browser) {
			toast({ message: 'Penyalinan hanya tersedia di peramban.', type: 'warning' });
			return;
		}

		const target = appAddress || window.location.host;
		if (!target) {
			toast({ message: 'Alamat aplikasi tidak ditemukan.', type: 'warning' });
			return;
		}

		if (!navigator.clipboard) {
			toast({ message: 'Clipboard tidak tersedia di perangkat ini.', type: 'warning' });
			return;
		}

		const scheme = protocol === 'https:' ? 'https://' : 'http://';
		const copyValue =
			target.startsWith('http://') || target.startsWith('https://') ? target : `${scheme}${target}`;

		try {
			copying = true;
			await navigator.clipboard.writeText(copyValue);
			toast({ message: 'Alamat aplikasi berhasil disalin.', type: 'success' });
		} catch (error) {
			console.error('Failed to copy app address', error);
			toast({ message: 'Gagal menyalin alamat. Salin manual ya.', type: 'error' });
		} finally {
			copying = false;
		}
	}
</script>

<section
	class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
>
	<div class="space-y-4">
		<header
			class="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4 dark:border-zinc-800"
		>
			<div class="space-y-1">
				<h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
					Pengaturan Aplikasi
				</h1>
				<p class="text-xs text-slate-600 dark:text-zinc-400">
					Pengaturan tambahan untuk lingkungan server lokal.
				</p>
			</div>
			<span
				class="inline-flex items-center rounded-full border border-blue-200/80 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 tabular-nums dark:border-blue-900/50 dark:bg-blue-950/50 dark:text-blue-300"
				>v{currentVersion}</span
			>
		</header>

		<div class="flex flex-col gap-1.5">
			<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Alamat aplikasi</span>
			<div class="flex flex-col gap-2 sm:flex-row">
				<input
					type="text"
					disabled
					class="h-9 flex-1 rounded-xl border border-slate-200 bg-slate-100 px-3 font-mono text-xs text-slate-700 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
					placeholder={appAddress || 'Tidak ada alamat terdeteksi'}
					value={appAddress}
				/>
				<button
					class="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
					type="button"
					onclick={copyAddress}
					disabled={!appAddress || copying}
				>
					<Icon name="copy" class="h-3.5 w-3.5" />
					{copying ? 'Menyalin…' : 'Salin'}
				</button>
			</div>
			{#if addresses.length > 1}
				<label class="mt-2 flex flex-col gap-1.5" for="addressSelector">
					<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
						>Alamat terdeteksi lainnya</span
					>
					<div class="relative flex items-center">
						<select
							id="addressSelector"
							class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
							bind:value={appAddress}
						>
							{#each addresses as address (address)}
								<option value={address}>{address}</option>
							{/each}
						</select>
						<span
							aria-hidden="true"
							class="pointer-events-none absolute right-2.5 flex items-center text-slate-500 dark:text-zinc-400"
						>
							<Icon name="down" class="h-3.5 w-3.5" />
						</span>
					</div>
				</label>
			{/if}
			<p class="text-xs text-slate-500 dark:text-zinc-400">
				Buka alamat ini pada perangkat lain di jaringan lokal yang sama.
			</p>
		</div>
	</div>
	<div
		class="mt-5 flex flex-col justify-end gap-2 border-t border-slate-200 pt-4 sm:flex-row dark:border-zinc-800"
	>
		{#if isAdmin}
			<a
				class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
				href="/master-data/pengguna"
			>
				<Icon name="users" class="h-4 w-4" />
				Akun Pengguna
			</a>
		{/if}
		<a
			class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
			href="/pengaturan/profil"
		>
			<Icon name="user" class="h-4 w-4" />
			Edit Profil
		</a>
	</div>
</section>
