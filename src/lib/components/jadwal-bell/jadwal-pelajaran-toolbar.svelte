<script lang="ts">
	import Icon from '$lib/components/icon.svelte';

	let {
		canManage,
		isEditing,
		dirty,
		saving,
		bellActive,
		hasAnyPlgManual,
		onBatal,
		onKode,
		onPengaturan,
		onResetJamPulang,
		onTambahKegiatan,
		onEdit,
		onSave,
		onHapusSemua,
		onToggleBell,
		onSimulasi
	}: {
		canManage: boolean;
		isEditing: boolean;
		dirty: boolean;
		saving: boolean;
		bellActive: boolean;
		hasAnyPlgManual: boolean;
		onBatal: () => void;
		onKode: () => void;
		onPengaturan: () => void;
		onResetJamPulang: () => void;
		onTambahKegiatan: () => void;
		onEdit: () => void;
		onSave: () => void;
		onHapusSemua: () => void;
		onToggleBell: () => void;
		onSimulasi: () => void;
	} = $props();
</script>

<div class="flex flex-wrap items-center justify-between gap-2">
	<div class="flex flex-wrap items-center gap-2">
		{#if isEditing}
			<button
				type="button"
				class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-amber-200/80 bg-amber-50 px-3.5 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-300 dark:hover:bg-amber-950"
				onclick={onBatal}
			>
				<Icon name="close" class="h-3.5 w-3.5" />
				Batal
			</button>
		{:else}
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a
				href="/akademik"
				class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
			>
				<Icon name="left" class="h-3.5 w-3.5" /> Kembali
			</a>
		{/if}
		<button
			type="button"
			class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 xl:hidden dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
			onclick={onKode}
			title="Kode Kegiatan"
		>
			<Icon name="grid" class="h-3.5 w-3.5" />
			Kode
		</button>
		<button
			type="button"
			class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
			onclick={onPengaturan}
			disabled={!canManage || isEditing}
			aria-disabled={!canManage || isEditing}
			title={!canManage || isEditing ? 'Anda tidak memiliki izin' : ''}
		>
			<Icon name="gear" class="h-3.5 w-3.5" />
			Pengaturan
		</button>
		{#if isEditing && hasAnyPlgManual}
			<button
				type="button"
				class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
				onclick={onResetJamPulang}
			>
				<Icon name="repeat" class="h-3.5 w-3.5" />
				Reset Jam Pulang
			</button>
		{:else}
			<button
				type="button"
				class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
				onclick={onTambahKegiatan}
				disabled={!canManage || isEditing}
				aria-disabled={!canManage || isEditing}
				title={!canManage || isEditing ? 'Anda tidak memiliki izin' : ''}
			>
				<Icon name="plus" class="h-3.5 w-3.5" />
				Tambah Kegiatan
			</button>
		{/if}
		{#if !isEditing && canManage}
			<button
				type="button"
				class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
				onclick={onEdit}
			>
				<Icon name="edit" class="h-3.5 w-3.5" />
				Edit
			</button>
		{/if}
		{#if dirty && isEditing}
			<button
				type="button"
				class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
				onclick={onSave}
				disabled={saving}
			>
				{#if saving}
					<span class="loading loading-spinner loading-xs"></span>
					Menyimpan…
				{:else}
					<Icon name="save" class="h-3.5 w-3.5" />
					Simpan Jadwal
				{/if}
			</button>
		{/if}
	</div>
	{#if isEditing}
		<button
			type="button"
			class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-red-200/80 bg-red-50 px-3.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950"
			onclick={onHapusSemua}
		>
			<Icon name="del" class="h-3.5 w-3.5" />
			Hapus semua
		</button>
	{:else}
		<div class="flex">
			<button
				type="button"
				class="inline-flex h-9 items-center justify-center gap-1.5 rounded-l-xl border px-3.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 {bellActive
					? 'border-red-200/80 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950'
					: 'border-emerald-200/80 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-950'}"
				onclick={onToggleBell}
				disabled={!canManage}
				aria-disabled={!canManage}
				title={!canManage ? 'Anda tidak memiliki izin' : ''}
			>
				<Icon name={bellActive ? 'pause' : 'play'} class="h-3.5 w-3.5" />
				{bellActive ? 'Pause Bell' : 'Play Bell'}
			</button>
			<div class="dropdown dropdown-end">
				<button
					type="button"
					class="inline-flex h-9 items-center justify-center rounded-r-xl border border-l-0 px-2.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 {bellActive
						? 'border-red-200/80 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950'
						: 'border-emerald-200/80 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-950'}"
					disabled={!canManage}
					aria-label="Menu bell"
				>
					<Icon name="more-vertical" class="h-3.5 w-3.5" />
				</button>
				<ul
					class="dropdown-content menu z-50 mt-2 w-44 rounded-xl border border-slate-200/80 bg-white p-1.5 text-xs shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
				>
					<li>
						<button
							type="button"
							class="flex items-center gap-2 rounded-lg text-slate-700 hover:bg-slate-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
							onclick={onSimulasi}
						>
							<Icon name="play" class="h-3.5 w-3.5" />
							Simulasi Bell
						</button>
					</li>
				</ul>
			</div>
		</div>
	{/if}
</div>
