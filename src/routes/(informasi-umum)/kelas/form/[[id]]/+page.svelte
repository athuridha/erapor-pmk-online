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
		<div
			class="mx-auto rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
		>
			<input type="hidden" name="waliKelasId" value={walasTerpilihId ?? ''} />
			<div class="mb-4 border-b border-slate-200 pb-3 dark:border-zinc-800">
				<h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
					Formulir Isian Data Kelas
				</h1>
			</div>
			{#if disableAcademic}
				<div
					class="mb-4 flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
				>
					<Icon name="warning" class="h-4 w-4 shrink-0" />
					<span>
						Atur tahun ajaran dan semester aktif melalui menu Rapor sebelum membuat atau mengubah
						data kelas.
					</span>
				</div>
			{:else}
				<div
					class="mb-4 flex items-start gap-2.5 rounded-xl border border-blue-200/80 bg-blue-50/75 px-3.5 py-3 text-xs text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/35 dark:text-blue-200"
				>
					<Icon name="info" class="mt-0.5 h-4 w-4 shrink-0" />
					<div class="space-y-0.5 leading-relaxed">
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
				<label class="flex flex-col gap-1.5">
					<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Nama Rombel</span>
					<input
						required
						type="text"
						class="validator h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 transition-colors placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
						placeholder="Contoh: X RPL 1"
						name="rombel"
					/>
				</label>

				<!-- Fase -->
				<label class="flex flex-col gap-1.5">
					<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Fase</span>
					<div class="relative flex items-center">
						<select
							class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 transition-colors focus:border-blue-600 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400 dark:disabled:bg-zinc-800"
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
						<span
							aria-hidden="true"
							class="pointer-events-none absolute right-2.5 flex items-center text-slate-500 dark:text-zinc-400"
						>
							<Icon name="down" class="h-3.5 w-3.5" />
						</span>
					</div>
				</label>

				<!-- Wali Kelas -->
				<div class="flex flex-col gap-1.5 md:col-span-2">
					<label
						class="text-xs font-semibold text-slate-700 dark:text-zinc-300"
						for="kelas-wali-select">Wali Kelas</label
					>
					<div class="relative flex items-center">
						<select
							id="kelas-wali-select"
							class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 transition-colors focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
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
						<span
							aria-hidden="true"
							class="pointer-events-none absolute right-2.5 flex items-center text-slate-500 dark:text-zinc-400"
						>
							<Icon name="down" class="h-3.5 w-3.5" />
						</span>
					</div>
					<p class="text-xs text-slate-500 dark:text-zinc-400">
						Pilih wali kelas dari daftar akun/pegawai. Nama dan NIP otomatis terhubung tanpa perlu
						diisi manual.
					</p>
				</div>
			</div>
			<div
				class="mt-6 flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800"
			>
				<a
					class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
					href="/kelas"
					aria-label="kembali"
				>
					<Icon name="left" class="h-4 w-4" />
					Kembali
				</a>
				<button
					class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
					disabled={submitting || disableAcademic}
				>
					{#if submitting}
						<span class="loading loading-spinner loading-sm"></span>
					{:else if data.kelas?.id}
						<Icon name="edit" class="h-4 w-4" />
						Update
					{:else}
						<Icon name="plus" class="h-4 w-4" />
						Tambah
					{/if}
				</button>
			</div>
		</div>
	{/snippet}
</FormEnhance>
