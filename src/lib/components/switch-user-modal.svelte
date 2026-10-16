<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	import { toast } from '$lib/components/toast.svelte';

	interface UserItem {
		id: number;
		username: string;
		fullName: string;
		role: string;
		roleLabel: string;
		kelasName: string | null;
	}

	let { open = $bindable(false), currentUserId = 0 } = $props<{
		open: boolean;
		currentUserId?: number;
	}>();

	let searchQuery = $state('');
	let users = $state<UserItem[]>([]);
	let isLoading = $state(false);
	let isSwitching = $state<number | null>(null);

	async function loadUsers(q = '') {
		isLoading = true;
		try {
			const res = await fetch(`/api/auth/switch-user/users?q=${encodeURIComponent(q)}`);
			const json = await res.json();
			if (res.ok && json.success) {
				users = json.users || [];
			} else {
				toast(json.message || 'Gagal memuat pengguna.', 'error');
			}
		} catch {
			toast('Koneksi gagal saat memuat daftar pengguna.', 'error');
		} finally {
			isLoading = false;
		}
	}

	$effect(() => {
		if (open) {
			searchQuery = '';
			loadUsers('');
		}
	});

	let searchTimer: NodeJS.Timeout;
	function handleSearchInput() {
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			loadUsers(searchQuery);
		}, 300);
	}

	async function handleSwitch(userId: number) {
		if (userId === currentUserId) {
			toast('Anda sudah menggunakan akun ini.', 'info');
			return;
		}

		isSwitching = userId;
		try {
			const res = await fetch('/api/auth/switch-user', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userId })
			});
			const json = await res.json();
			if (res.ok && json.success) {
				toast(json.message || 'Berhasil beralih akun.', 'success');
				open = false;
				window.location.href = '/';
			} else {
				toast(json.message || 'Gagal beralih akun.', 'error');
			}
		} catch {
			toast('Terjadi kesalahan saat beralih akun.', 'error');
		} finally {
			isSwitching = null;
		}
	}
</script>

{#if open}
	<div class="modal modal-open z-50">
		<div class="modal-box rounded-2xl max-w-lg p-6">
			<div class="flex items-center justify-between pb-3 border-b border-base-200">
				<div class="flex items-center gap-2.5">
					<div class="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
						<Icon name="repeat" class="w-5 h-5 text-emerald-700" />
					</div>
					<div>
						<h3 class="text-base font-bold text-emerald-950 dark:text-emerald-300">
							Beralih Akun (Switch User)
						</h3>
						<p class="text-[11px] text-base-content/70">
							Masuk sebagai guru atau akun lain untuk verifikasi tanpa perlu kata sandi.
						</p>
					</div>
				</div>
				<button
					type="button"
					class="btn btn-sm btn-ghost btn-circle"
					onclick={() => (open = false)}
				>
					<Icon name="close" />
				</button>
			</div>

			<!-- Search -->
			<div class="mt-4">
				<label class="input input-sm bg-base-200 w-full rounded-xl flex items-center gap-2">
					<Icon name="search" class="text-base-content/60" />
					<input
						type="search"
						class="grow text-xs"
						placeholder="Cari nama pengguna atau nama guru..."
						bind:value={searchQuery}
						oninput={handleSearchInput}
					/>
				</label>
			</div>

			<!-- List Users -->
			<div class="mt-4 max-h-72 overflow-y-auto space-y-2 pr-1">
				{#if isLoading}
					<div class="flex items-center justify-center py-8 text-xs text-base-content/60 gap-2">
						<span class="loading loading-spinner loading-xs"></span>
						<span>Memuat daftar akun...</span>
					</div>
				{:else if users.length === 0}
					<div class="text-center py-8 text-xs text-base-content/60 italic">
						Tidak ada akun yang sesuai dengan pencarian.
					</div>
				{:else}
					{#each users as u (u.id)}
						<div
							class="flex items-center justify-between p-3 rounded-xl border border-base-200 bg-base-100 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-colors gap-3"
						>
							<div class="flex items-center gap-3 overflow-hidden">
								<div class="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 flex items-center justify-center shrink-0 font-bold text-xs">
									<Icon name="user" class="w-4 h-4" />
								</div>
								<div class="overflow-hidden">
									<div class="text-xs font-bold text-base-content truncate">
										{u.fullName}
									</div>
									<div class="text-[10px] text-base-content/60 flex items-center gap-1.5 flex-wrap">
										<span class="font-mono">@{u.username}</span>
										<span>&bull;</span>
										<span class="badge badge-xs font-semibold badge-soft badge-primary">
											{u.roleLabel}
										</span>
										{#if u.kelasName}
											<span class="text-emerald-700 dark:text-emerald-400 font-medium">({u.kelasName})</span>
										{/if}
									</div>
								</div>
							</div>

							<button
								type="button"
								class="btn btn-xs btn-primary rounded-lg shadow-none shrink-0 font-semibold"
								disabled={isSwitching !== null || u.id === currentUserId}
								onclick={() => handleSwitch(u.id)}
							>
								{#if isSwitching === u.id}
									<span class="loading loading-spinner loading-xs"></span>
								{:else if u.id === currentUserId}
									<span>Aktif</span>
								{:else}
									<Icon name="repeat" class="w-3 h-3" />
									<span>Pilih</span>
								{/if}
							</button>
						</div>
					{/each}
				{/if}
			</div>

			<div class="modal-action mt-4 pt-3 border-t border-base-200">
				<button
					type="button"
					class="btn btn-sm btn-ghost rounded-xl"
					onclick={() => (open = false)}
				>
					Tutup
				</button>
			</div>
		</div>
	</div>
{/if}
