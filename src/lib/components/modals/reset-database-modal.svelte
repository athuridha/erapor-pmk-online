<script lang="ts">
	import { hideModal } from '$lib/components/global-modal.svelte';
	import Icon from '$lib/components/icon.svelte';
	import { toast } from '$lib/components/toast.svelte';

	let submitting = $state(false);
	let showPassword = $state(false);
	let password = $state('');

	async function handleReset() {
		if (!password || submitting) return;

		submitting = true;
		try {
			const formData = new FormData();
			formData.append('password', password);

			const response = await fetch('/api/database/reset', { method: 'POST', body: formData });
			// The auth guard may answer with a redirect that resolves to an HTML
			// page; only treat an actual JSON API response as success.
			const isJson = (response.headers.get('content-type') ?? '').includes('application/json');
			if (!response.ok || !isJson) {
				const err = isJson ? await response.json().catch(() => null) : null;
				throw new Error(err?.message ?? 'Gagal mereset database.');
			}

			hideModal();
			toast({
				message: 'Database berhasil direset. Mengalihkan ke halaman login…',
				type: 'success'
			});
			setTimeout(() => {
				window.location.href = '/login';
			}, 1400);
		} catch (e) {
			toast({
				message: e instanceof Error ? e.message : 'Gagal mereset database.',
				type: 'error'
			});
		} finally {
			submitting = false;
		}
	}
</script>

<form
	class="space-y-4"
	onsubmit={(event) => {
		event.preventDefault();
		handleReset();
	}}
>
	<div class="space-y-4">
		<p class="text-xs leading-relaxed text-slate-600 dark:text-zinc-300">
			Seluruh isi database akan <strong class="text-slate-900 dark:text-zinc-100"
				>dikosongkan</strong
			>: data sekolah, siswa, nilai, presensi, pengguna, dan pengaturan lainnya dihapus dan aplikasi
			kembali ke kondisi awal.
		</p>

		<div
			role="alert"
			class="flex items-start gap-2.5 rounded-xl border border-red-200/80 bg-red-50/80 px-4 py-3 text-xs text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
		>
			<Icon name="warning" class="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
			<span>
				Tindakan ini tidak dapat dibatalkan. Pastikan Anda sudah melakukan Backup Data terlebih
				dahulu.
			</span>
		</div>

		<div>
			<label
				for="reset-db-password"
				class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
			>
				Konfirmasi kata sandi
			</label>
			<div class="relative flex items-center">
				<span
					aria-hidden="true"
					class="pointer-events-none absolute left-3 flex items-center text-slate-400 dark:text-zinc-400"
				>
					<Icon name="lock" class="h-3.5 w-3.5" />
				</span>
				<input
					id="reset-db-password"
					bind:value={password}
					type={showPassword ? 'text' : 'password'}
					name="password"
					required
					placeholder="Masukkan kata sandi saat ini"
					autocomplete="current-password"
					disabled={submitting}
					class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white pr-9 pl-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
				/>
				<button
					type="button"
					class="absolute right-2.5 flex items-center text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
					onclick={() => (showPassword = !showPassword)}
					aria-label="Lihat atau sembunyikan kata sandi"
				>
					<Icon name={showPassword ? 'eye-off' : 'eye'} class="h-3.5 w-3.5" />
				</button>
			</div>
			<p class="mt-1.5 text-[11px] text-slate-500 dark:text-zinc-400">
				Masukkan kata sandi akun Anda saat ini untuk mengonfirmasi reset.
			</p>
		</div>
	</div>

	<div class="flex justify-end gap-2 border-t border-slate-100 pt-3 dark:border-zinc-800">
		<button
			type="button"
			class="inline-flex h-9 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
			onclick={hideModal}
			disabled={submitting}>Batal</button
		>
		<button
			type="submit"
			class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-red-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
			disabled={submitting || !password}
		>
			{#if submitting}
				<span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
			{/if}
			{submitting ? 'Mereset...' : 'Reset'}
		</button>
	</div>
</form>
