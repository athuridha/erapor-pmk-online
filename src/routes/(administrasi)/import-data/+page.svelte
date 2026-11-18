<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import type { PageData } from './$types';

	type Aksi = 'baru' | 'ubah' | 'tetap' | 'gagal';
	type BarisPratinjau = {
		sheet: string;
		no: number;
		kunci: string;
		aksi: Aksi;
		ringkas: string;
		alasan?: string;
	};
	type RingkasanSheet = {
		key: string;
		nama: string;
		baru: number;
		ubah: number;
		tetap: number;
		gagal: number;
	};
	type FormData = {
		message?: string;
		fail?: string;
		token?: string;
		namaBerkas?: string;
		galatSheet?: string[];
		pratinjau?: { baris: BarisPratinjau[]; ringkasan: RingkasanSheet[]; akanDitulis: number };
		hasil?: { dibuat: number; diubah: number; gagal: number; pesan: string[] };
	};

	let { data, form }: { data: PageData; form: FormData | null } = $props();

	let namaBerkas = $state('');
	let saring = $state<'ditulis' | 'gagal' | 'semua'>('ditulis');

	const pratinjau = $derived(form?.pratinjau ?? null);
	const semuaBaris = $derived(pratinjau?.baris ?? []);
	const jumlah = $derived({
		ditulis: semuaBaris.filter((b) => b.aksi === 'baru' || b.aksi === 'ubah').length,
		gagal: semuaBaris.filter((b) => b.aksi === 'gagal').length,
		semua: semuaBaris.length
	});
	const tampil = $derived(
		semuaBaris.filter((b) => {
			if (saring === 'semua') return true;
			if (saring === 'gagal') return b.aksi === 'gagal';
			return b.aksi === 'baru' || b.aksi === 'ubah';
		})
	);
	const grup = $derived(
		data.sheets
			.map((sheet) => ({ sheet, baris: tampil.filter((b) => b.sheet === sheet.key) }))
			.filter((g) => g.baris.length > 0)
	);

	function lencana(aksi: Aksi) {
		if (aksi === 'baru') {
			return 'border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300';
		}
		if (aksi === 'ubah') {
			return 'border-blue-200/80 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/50 dark:text-blue-300';
		}
		if (aksi === 'gagal') {
			return 'border-red-200/80 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300';
		}
		return 'border-slate-200/80 bg-slate-100 text-slate-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
	}

	function labelAksi(aksi: Aksi) {
		if (aksi === 'baru') return 'baru';
		if (aksi === 'ubah') return 'diubah';
		if (aksi === 'gagal') return 'gagal';
		return 'tetap';
	}
</script>

<div class="flex flex-col gap-5">
	<section
		class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
	>
		<div
			class="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-zinc-800"
		>
			<div>
				<h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
					Impor Data Excel
				</h1>
				<p class="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
					{#if data.semester}
						Menulis ke semester aktif: <strong class="text-slate-700 dark:text-zinc-200"
							>{data.semester.nama}</strong
						>
						· {data.semester.tahunAjaran}
					{:else}
						Belum ada semester aktif. Atur dulu di halaman Akademik.
					{/if}
				</p>
			</div>
			<a
				class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
				href="/import-data/template"
			>
				<Icon name="download" class="h-3.5 w-3.5" />
				Template Excel
			</a>
		</div>

		<div class="mb-4 flex flex-wrap gap-2">
			<span
				class="inline-flex items-center rounded-full border border-slate-200/80 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
			>
				{data.hitung?.pegawai ?? 0} pegawai
			</span>
			<span
				class="inline-flex items-center rounded-full border border-slate-200/80 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
			>
				{data.hitung?.kelas ?? 0} kelas
			</span>
			<span
				class="inline-flex items-center rounded-full border border-slate-200/80 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
			>
				{data.hitung?.murid ?? 0} murid
			</span>
		</div>

		<p class="text-xs leading-relaxed text-slate-600 dark:text-zinc-300">
			Jalur impor ini melengkapi sinkronisasi Dapodik: data pokok bisa dimasukkan atau diperbarui
			dari berkas Excel, tanpa harus lewat Dapodik.
		</p>
		<ol class="mt-2.5 list-inside list-decimal space-y-1 text-xs text-slate-600 dark:text-zinc-300">
			<li>Unduh template, isi sheet yang diperlukan (boleh satu sheet saja).</li>
			<li>Unggah berkas, lalu tekan Pratinjau.</li>
			<li>Periksa baris yang akan ditulis dan baris yang gagal, baru tekan Simpan.</li>
		</ol>
	</section>

	{#if data.sheets.length}
		<section
			class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
		>
			<div class="mb-3 flex items-center justify-between">
				<h2 class="text-base font-bold tracking-tight text-slate-900 dark:text-zinc-100">
					Sheet yang Dikenali
				</h2>
				<span class="text-[11px] text-slate-500 dark:text-zinc-400"
					>Tanda * berarti kolom wajib diisi.</span
				>
			</div>
			<div class="grid gap-3 lg:grid-cols-2">
				{#each data.sheets as sheet (sheet.key)}
					<div
						class="flex flex-col gap-1.5 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/45"
					>
						<div class="flex items-center gap-2">
							<Icon name="table" class="h-4 w-4 text-blue-600 dark:text-blue-400" />
							<p class="text-xs font-bold text-slate-900 dark:text-zinc-100">Sheet {sheet.sheet}</p>
						</div>
						<p class="text-xs text-slate-600 dark:text-zinc-300">
							{sheet.ringkas} Dicocokkan lewat {sheet.kunci}.
						</p>
						<p class="text-[11px] text-slate-500 dark:text-zinc-400">
							{sheet.kolom.map((k) => (k.wajib ? `${k.label}*` : k.label)).join(' · ')}
						</p>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	<section
		class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
	>
		<h2 class="mb-3 text-base font-bold tracking-tight text-slate-900 dark:text-zinc-100">
			Unggah Berkas
		</h2>
		<FormEnhance
			id="import-data-pratinjau"
			action="?/pratinjau"
			enctype="multipart/form-data"
			showToast={true}
		>
			{#snippet children({ submitting })}
				<div class="space-y-3">
					<div>
						<label
							class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
							for="import-data-file"
						>
							Berkas Excel (.xlsx)
						</label>
						<input
							id="import-data-file"
							class="file-input file-input-bordered w-full rounded-xl border-[#7e8b9b] bg-white text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
							type="file"
							name="file"
							required
							accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
							onchange={(e) => {
								const berkas = (e.currentTarget as HTMLInputElement).files?.[0];
								namaBerkas = berkas?.name ?? '';
							}}
						/>
						<p class="mt-1.5 text-[11px] text-slate-500 dark:text-zinc-400">
							Maksimal 2MB. Data dicocokkan dengan yang sudah ada: cocok diperbarui, belum ada
							ditambahkan.
							{#if namaBerkas}
								· Berkas dipilih: <strong class="text-slate-700 dark:text-zinc-200"
									>{namaBerkas}</strong
								>
							{/if}
						</p>
					</div>
					<div class="flex justify-end">
						<button
							class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
							type="submit"
							disabled={submitting || !namaBerkas}
						>
							{#if submitting}
								<span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
							{:else}
								<Icon name="eye" class="h-3.5 w-3.5" />
							{/if}
							Pratinjau
						</button>
					</div>
				</div>
			{/snippet}
		</FormEnhance>
	</section>

	{#if form?.galatSheet?.length}
		<div
			role="alert"
			class="flex items-start gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200"
		>
			<Icon name="warning" class="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
			<div class="flex flex-col gap-1">
				{#each form.galatSheet as pesan, i (i)}
					<span>{pesan}</span>
				{/each}
			</div>
		</div>
	{/if}

	{#if form?.hasil}
		<div
			role="alert"
			class="flex items-start gap-2.5 rounded-xl border px-4 py-3 text-xs {form.hasil.gagal
				? 'border-amber-200/80 bg-amber-50/80 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200'
				: 'border-emerald-200/80 bg-emerald-50/80 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200'}"
		>
			<Icon
				name={form.hasil.gagal ? 'warning' : 'success'}
				class="mt-0.5 h-4 w-4 shrink-0 {form.hasil.gagal
					? 'text-amber-600 dark:text-amber-400'
					: 'text-emerald-600 dark:text-emerald-400'}"
			/>
			<div class="flex flex-col gap-1">
				<span class="font-medium">
					{form.hasil.dibuat} data baru, {form.hasil.diubah} data diperbarui{form.hasil.gagal
						? `, ${form.hasil.gagal} baris gagal`
						: ''}.
				</span>
				{#each form.hasil.pesan as pesan, i (i)}
					<span>{pesan}</span>
				{/each}
			</div>
		</div>
	{/if}

	{#if pratinjau}
		<section
			class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
		>
			<div
				class="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-zinc-800"
			>
				<div>
					<h2 class="text-base font-bold tracking-tight text-slate-900 dark:text-zinc-100">
						Pratinjau
					</h2>
					{#if form?.namaBerkas}
						<p class="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
							Berkas: {form.namaBerkas}
						</p>
					{/if}
				</div>
				<div
					role="group"
					class="inline-flex rounded-xl border border-slate-200/80 bg-slate-50 p-1 dark:border-zinc-700 dark:bg-zinc-800"
					aria-label="Saring hasil pratinjau"
				>
					<button
						type="button"
						class="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors {saring ===
						'ditulis'
							? 'bg-blue-600 text-white shadow-xs dark:bg-blue-500'
							: 'text-slate-600 hover:text-slate-900 dark:text-zinc-300 dark:hover:text-white'}"
						onclick={() => (saring = 'ditulis')}
					>
						Akan ditulis ({jumlah.ditulis})
					</button>
					<button
						type="button"
						class="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors {saring ===
						'gagal'
							? 'bg-blue-600 text-white shadow-xs dark:bg-blue-500'
							: 'text-slate-600 hover:text-slate-900 dark:text-zinc-300 dark:hover:text-white'}"
						onclick={() => (saring = 'gagal')}
					>
						Gagal ({jumlah.gagal})
					</button>
					<button
						type="button"
						class="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors {saring ===
						'semua'
							? 'bg-blue-600 text-white shadow-xs dark:bg-blue-500'
							: 'text-slate-600 hover:text-slate-900 dark:text-zinc-300 dark:hover:text-white'}"
						onclick={() => (saring = 'semua')}
					>
						Semua ({jumlah.semua})
					</button>
				</div>
			</div>

			<div class="mb-4 flex flex-wrap gap-2">
				{#each pratinjau.ringkasan as ringkas (ringkas.key)}
					<span
						class="inline-flex items-center rounded-full border border-slate-200/80 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
					>
						{ringkas.nama}: {ringkas.baru} baru · {ringkas.ubah} diubah · {ringkas.tetap} tetap
						{ringkas.gagal ? `· ${ringkas.gagal} gagal` : ''}
					</span>
				{/each}
			</div>

			{#if tampil.length === 0}
				<p class="py-3 text-xs text-slate-500 dark:text-zinc-400">
					{saring === 'gagal'
						? 'Tidak ada baris yang gagal.'
						: 'Tidak ada baris yang perlu ditulis. Data di berkas sudah sama dengan data tersimpan.'}
				</p>
			{:else}
				<div class="space-y-4">
					{#each grup as g (g.sheet.key)}
						<div class="flex flex-col gap-2">
							<h3 class="text-xs font-bold text-slate-800 dark:text-zinc-200">
								Sheet {g.sheet.sheet}
								<span class="font-normal text-slate-500 dark:text-zinc-400"
									>({g.baris.length} baris)</span
								>
							</h3>
							<div
								class="overflow-x-auto rounded-xl border border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900"
							>
								<table class="w-full border-collapse text-xs">
									<thead>
										<tr
											class="border-b border-slate-200/80 bg-slate-50/80 text-left font-semibold text-slate-600 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300"
										>
											<th class="w-14 px-3.5 py-2.5">Baris</th>
											<th class="w-24 px-3.5 py-2.5">Hasil</th>
											<th class="px-3.5 py-2.5">Data</th>
											<th class="px-3.5 py-2.5">Keterangan</th>
										</tr>
									</thead>
									<tbody class="divide-y divide-slate-100 dark:divide-zinc-800/80">
										{#each g.baris as baris (baris.no + baris.sheet + baris.kunci)}
											<tr class="transition-colors hover:bg-slate-50/70 dark:hover:bg-zinc-800/40">
												<td class="px-3.5 py-2 font-mono text-slate-500 dark:text-zinc-400">
													{baris.no || '-'}
												</td>
												<td class="px-3.5 py-2">
													<span
														class="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold {lencana(
															baris.aksi
														)}"
													>
														{labelAksi(baris.aksi)}
													</span>
												</td>
												<td class="px-3.5 py-2 font-medium text-slate-900 dark:text-zinc-100">
													{baris.kunci}
												</td>
												<td class="px-3.5 py-2 text-slate-600 dark:text-zinc-300">
													{baris.alasan ?? baris.ringkas}
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</div>
					{/each}
				</div>
			{/if}

			{#if form?.token}
				<FormEnhance id="import-data-simpan" action="?/simpan" showToast={true}>
					{#snippet children({ submitting })}
						<input type="hidden" name="token" value={form.token} />
						<div
							class="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-zinc-800"
						>
							<p class="text-xs text-slate-500 dark:text-zinc-400">
								Menulis {pratinjau.akanDitulis} baris ke semester aktif. Data yang cocok akan diperbarui.
							</p>
							<button
								class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
								type="submit"
								disabled={submitting || pratinjau.akanDitulis === 0}
							>
								{#if submitting}
									<span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
								{:else}
									<Icon name="save" class="h-3.5 w-3.5" />
								{/if}
								Simpan
							</button>
						</div>
					{/snippet}
				</FormEnhance>
			{/if}
		</section>
	{/if}
</div>
