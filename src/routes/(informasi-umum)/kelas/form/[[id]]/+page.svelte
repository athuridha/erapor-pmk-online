<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';

	let { data } = $props();
	const disableAcademic = $derived.by(
		() => !data.academicLock?.tahunAjaranId || !data.academicLock?.semesterId
	);
	const tahunAjaranLabel = $derived.by(() => data.academicLock?.tahunAjaranLabel ?? 'Belum diatur');
	const semesterLabel = $derived.by(() => data.academicLock?.semesterLabel ?? 'Belum diatur');

	// svelte-ignore state_referenced_locally
	let walasTerpilihId = $state<number | string>(data.kelas?.waliKelasId ?? '');
	const waliOptions = $derived(data.waliKelasOptions ?? []);
</script>

<FormEnhance
	action="?/save"
	init={data.formInit}
	onsuccess={async () => {
		await goto('/kelas');
		await invalidate('app:kelas');
	}}
>
	{#snippet children({ submitting })}
		<div class="card bg-base-100 mx-auto rounded-lg p-4 shadow-md">
			<input type="hidden" name="waliKelasId" value={walasTerpilihId ?? ''} />
			<h2 class="mb-4 text-xl font-bold">Formulir Isian Data Kelas</h2>
			{#if disableAcademic}
				<div class="alert alert-warning mb-4 flex items-center gap-3">
					<Icon name="warning" />
					<span>
						Atur tahun ajaran dan semester aktif melalui menu Rapor sebelum membuat atau mengubah
						data kelas.
					</span>
				</div>
			{:else}
				<div class="alert alert-info mb-4 flex items-center gap-3">
					<Icon name="info" />
					<div class="leading-tight">
						<p>
							<span class="font-semibold">Tahun ajaran aktif:</span>
							{tahunAjaranLabel}
						</p>
						<p>
							<span class="font-semibold">Semester aktif:</span>
							{semesterLabel}
						</p>
						<p>
							NIP harus ditulis lengkap apakah NIP, NIPPPK, NIY, atau NIPY. Misalnya: "NIPPPK.
							199004052020212001"
						</p>
					</div>
				</div>
			{/if}
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
				<!-- Nama Rombel -->
				<div class="fieldset">
					<legend class="fieldset-legend">Nama Rombel</legend>
					<input
						required
						type="text"
						class="input validator bg-base-200 dark:bg-base-300 w-full dark:border-none"
						placeholder="Contoh: X RPL 1"
						name="rombel"
					/>
				</div>

				<!-- Fase -->
				<div class="fieldset">
					<legend class="fieldset-legend">Fase</legend>
					<select
						class="select bg-base-200 dark:bg-base-300 w-full truncate dark:border-none"
						title="Pilih tingkat pendidikan"
						name="fase"
						disabled={!data.tingkatOptions?.length}
					>
						<option value="" disabled selected>Pilih fase</option>
						{#each data.tingkatOptions ?? [] as option (option.fase)}
							<option value={option.fase}>{option.label}</option>
						{:else}
							<option value="" disabled>
								Atur data sekolah terlebih dahulu untuk memilih fase
							</option>
						{/each}
					</select>
				</div>

				<!-- Wali Kelas -->
				<div class="fieldset md:col-span-2">
					<legend class="fieldset-legend">Wali Kelas</legend>
					<select
						class="select bg-base-200 dark:bg-base-300 w-full truncate dark:border-none"
						name="waliKelasId"
						bind:value={walasTerpilihId}
					>
						<option value="">-- Tanpa Wali Kelas --</option>
						{#if waliOptions.length > 0}
							{#if waliOptions.some((o) => o.isWaliKelas)}
								<optgroup label="Akun Wali Kelas">
									{#each waliOptions.filter((o) => o.isWaliKelas) as opsi (opsi.id)}
										<option value={opsi.id}>
											{opsi.nama}
											{opsi.nip ? `(${opsi.nip})` : ''}
										</option>
									{/each}
								</optgroup>
							{/if}
							{#if waliOptions.some((o) => !o.isWaliKelas)}
								<optgroup label="Guru / Pegawai Lainnya">
									{#each waliOptions.filter((o) => !o.isWaliKelas) as opsi (opsi.id)}
										<option value={opsi.id}>
											{opsi.nama}
											{opsi.nip ? `(${opsi.nip})` : ''}
										</option>
									{/each}
								</optgroup>
							{/if}
						{:else}
							<option disabled value="">- Belum ada pegawai / akun wali kelas -</option>
						{/if}
					</select>
					<p class="label text-wrap text-xs text-base-content/60">
						Pilih wali kelas dari daftar akun/pegawai. Nama dan NIP otomatis terhubung tanpa perlu
						diisi manual.
					</p>
				</div>
			</div>
			<!-- mobile: 2-col grid -->
			<div class="mt-6 grid grid-cols-2 gap-2 md:hidden">
				<a class="btn btn-soft shadow-none" href="/kelas" aria-label="kembali">
					<Icon name="left" />
					Kembali
				</a>
				<button
					class="btn shadow-none {data.kelas?.id ? 'btn-secondary' : 'btn-primary'}"
					disabled={submitting || disableAcademic}
				>
					{#if submitting}
						<div class="loading loading-spinner"></div>
					{:else if data.kelas?.id}
						<Icon name="edit" />
						Update
					{:else}
						<Icon name="plus" />
						Tambah
					{/if}
				</button>
			</div>
			<!-- desktop: original flex layout -->
			<div class="mt-6 hidden justify-between gap-2 md:flex">
				<a class="btn btn-soft shadow-none" href="/kelas" aria-label="kembali">
					<Icon name="left" />
					Kembali
				</a>
				<div class="flex flex-wrap justify-end gap-2">
					<button
						class="btn shadow-none {data.kelas?.id ? 'btn-secondary' : 'btn-primary'}"
						disabled={submitting || disableAcademic}
					>
						{#if submitting}
							<div class="loading loading-spinner"></div>
						{:else if data.kelas?.id}
							<Icon name="edit" />
							Update
						{:else}
							<Icon name="plus" />
							Tambah
						{/if}
					</button>
				</div>
			</div>
		</div>
	{/snippet}
</FormEnhance>
