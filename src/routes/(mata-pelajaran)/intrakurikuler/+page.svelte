<script lang="ts">
	import { page } from '$app/state';
	import { invalidate } from '$app/navigation';
	import { enhance } from '$app/forms';
	import Icon from '$lib/components/icon.svelte';
	import { flip } from 'svelte/animate';
	import { modalRoute } from '$lib/utils';
	import ImportMapelDialog from '$lib/components/intrakurikuler/import-mapel-dialog.svelte';
	import { toast } from '$lib/components/toast.svelte';
	import {
		agamaMapelLabelByName,
		agamaMapelNames,
		agamaParentName,
		jenisMapel,
		pksMapelLabelByName,
		pksMapelNames,
		pksParentName
	} from '$lib/statics';
	import IntrakurikulerModals from '$lib/components/intrakurikuler/modals.svelte';
	import { touchDragSource, dropTarget } from '$lib/touch-drag.svelte';

	type MapelWithIndicator = MataPelajaran & {
		tpCount: number;
		editTpMapelId?: number;
		keteranganDapodik?: string | null;
		dapodikIndukPembelajaranId?: string | null;
	};
	let {
		data
	}: {
		data: {
			mapel: { daftarMapel: MapelWithIndicator[] };
			kelasId?: number | null;
			adaDataDapodik?: boolean;
		};
	} = $props();

	let importMapelOpen = $state(false);

	const emptyStateMessage = 'Belum ada data mata pelajaran';
	const agamaMapelNameSet = new Set<string>(agamaMapelNames);
	const pksMapelNameSet = new Set<string>(pksMapelNames);

	const kelasAktifLabel = $derived.by(() => {
		const kelas = page.data.kelasAktif ?? null;
		if (!kelas) return null;
		return kelas.fase ? `${kelas.nama} - ${kelas.fase}` : kelas.nama;
	});

	const hasKelasAktif = $derived.by(() => !!page.data.kelasAktif);
	// server-provided small permission flag: if false, UI for managing
	// mata pelajaran should be disabled for this client (role 'user').
	const canManageMapel = $derived.by(() => {
		const u = page.data.user as { canManageMapel?: boolean } | null | undefined;
		// default to true for backwards compatibility
		return u?.canManageMapel ?? true;
	});
	const baseCanEditUrutan = $derived.by(() => {
		const u = page.data.user as { canEditUrutan?: boolean } | null | undefined;
		return u?.canEditUrutan ?? false;
	});
	const baseCanAddImportMapel = $derived.by(() => {
		const u = page.data.user as { canAddImportMapel?: boolean } | null | undefined;
		return u?.canAddImportMapel ?? false;
	});

	// Wali kelas sedang melihat kelas bukan miliknya (mis. kelas tempat ia hanya
	// jadi guru mapel) → hak turun ke level guru: tak bisa tambah/impor/urutan.
	const isNonOwnClass = $derived.by(() => {
		const u = page.data.user as
			{ type?: string; kelasId?: number | null; ownKelasIds?: number[] | null } | null | undefined;
		if (u?.type !== 'wali_kelas' || data.kelasId == null) return false;
		const ownIds = u.ownKelasIds?.length ? u.ownKelasIds : u.kelasId != null ? [u.kelasId] : [];
		return ownIds.length > 0 && !ownIds.includes(data.kelasId);
	});
	const canEditUrutan = $derived(baseCanEditUrutan && !isNonOwnClass);
	const canAddImportMapel = $derived(baseCanAddImportMapel && !isNonOwnClass);

	// Dapatkan jenjang varian dari sekolah (misalnya 'SMK')
	const jenjangVariant = $derived.by(() => {
		const sekolah = page.data.sekolah as { jenjangVariant?: string | null } | null | undefined;
		return sekolah?.jenjangVariant ?? null;
	});

	// Fungsi khusus untuk jenjang SMK: ubah label "Wajib" menjadi "Umum"
	function getWajibLabel(): string {
		return jenjangVariant?.toUpperCase() === 'SMK' ? 'Umum' : 'Wajib';
	}

	// Fungsi untuk mengecek apakah section kejuruan harus ditampilkan (hanya untuk SMK)
	function shouldShowKejuruan(): boolean {
		return jenjangVariant?.toUpperCase() === 'SMK';
	}

	// Fungsi untuk mengecek apakah section pemberdayaan harus ditampilkan (hanya untuk PKBM/SKB)
	function shouldShowPemberdayaan(): boolean {
		return ['PKBM', 'SKB'].includes(jenjangVariant?.toUpperCase() ?? '');
	}

	// Satu daftar gabungan seluruh jenis, sudah diurutkan server (belum dipetakan
	// paling atas). Baris kejuruan/pemberdayaan hanya tampil sesuai jenjang sekolah
	// (SMK / PKBM-SKB) — konsisten dengan kotak statistiknya.
	const daftarMapel = $derived(
		(data.mapel.daftarMapel ?? []).filter((item) => {
			if (item.jenis === 'kejuruan') return shouldShowKejuruan();
			if (item.jenis === 'pemberdayaan') return shouldShowPemberdayaan();
			return true;
		})
	);
	const totalMapel = $derived(daftarMapel.length);

	const hitunganJenis = $derived.by(() => {
		const acc: Record<MataPelajaran['jenis'], number> = {
			belum_dipetakan: 0,
			wajib: 0,
			pilihan: 0,
			mulok: 0,
			kejuruan: 0,
			pemberdayaan: 0
		};
		for (const item of daftarMapel) {
			if (item.jenis && item.jenis in acc) acc[item.jenis] += 1;
		}
		return acc;
	});

	function formatKkm(kkm: number | null | undefined) {
		return typeof kkm === 'number' && Number.isFinite(kkm) ? kkm : '-';
	}

	// ── Edit Urutan (drag-and-drop) ──
	let editUrutan = $state(false);
	let urutanList = $state<MapelWithIndicator[]>([]);
	let dragIndex = $state<number | null>(null);
	let simpanUrutanPending = $state(false);

	function mulaiEditUrutan() {
		urutanList = [...daftarMapel];
		dragIndex = null;
		editUrutan = true;
	}

	function batalEditUrutan() {
		editUrutan = false;
		dragIndex = null;
	}

	function handleDragStart(index: number, e: DragEvent) {
		dragIndex = index;
		e.dataTransfer?.setData('text/plain', String(index));
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
	}

	function handleDragOver(e: DragEvent) {
		if (dragIndex === null) return;
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
	}

	function handleDrop(index: number) {
		if (dragIndex === null || dragIndex === index) {
			dragIndex = null;
			return;
		}
		const [moved] = urutanList.splice(dragIndex, 1);
		urutanList.splice(index, 0, moved);
		dragIndex = null;
	}

	// Live reorder preview (pointer drag): the dragged row jumps into the slot
	// under the cursor and `animate:flip` slides the rows in real time.
	function reorderHover(targetEl: HTMLElement) {
		const id = Number(targetEl.dataset.mapelId);
		if (!Number.isFinite(id) || dragIndex === null) return;
		const to = urutanList.findIndex((m) => m.id === id);
		if (to === -1 || to === dragIndex) return;
		const [moved] = urutanList.splice(dragIndex, 1);
		urutanList.splice(to, 0, moved);
		dragIndex = to;
	}

	const barisTampil = $derived(editUrutan ? urutanList : daftarMapel);

	function handleDeleteClick(event: MouseEvent, mapel: Pick<MataPelajaran, 'nama'>) {
		if (event.defaultPrevented) return;
		if (event.shiftKey || event.metaKey || event.ctrlKey || event.button === 1) return;

		const isAgama = agamaMapelNameSet.has(mapel.nama);
		const isPks = pksMapelNameSet.has(mapel.nama);

		if (!isAgama && !isPks) return;

		let message = '';
		if (isAgama) {
			const label = agamaMapelLabelByName[mapel.nama];
			message =
				mapel.nama === agamaParentName
					? `Menghapus "<b>${mapel.nama}</b>" akan menghapus seluruh varian Pendidikan Agama dan Budi Pekerti pada kelas ini.`
					: `Menghapus "<b>${mapel.nama}</b>" akan menghapus varian Pendidikan Agama <b>${label}</b> beserta seluruh penilaian terkait.`;
		} else if (isPks) {
			const label = pksMapelLabelByName[mapel.nama];
			message =
				mapel.nama === pksParentName
					? `Menghapus "<b>${mapel.nama}</b>" akan menghapus seluruh varian Pendalaman Kitab Suci pada kelas ini.`
					: `Menghapus "<b>${mapel.nama}</b>" akan menghapus varian PKS <b>${label}</b> beserta seluruh penilaian terkait.`;
		}

		if (message) {
			toast({ message, type: 'warning', persist: true });
		}
	}
</script>

<div
	class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
>
	<div
		class="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800"
	>
		<div>
			<h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
				Daftar Mata Pelajaran Intrakurikuler
			</h1>
			{#if kelasAktifLabel}
				<p class="mt-0.5 text-xs text-slate-600 dark:text-zinc-400">
					Kelas aktif: {kelasAktifLabel}
				</p>
			{:else}
				<p class="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
					Pilih kelas pada pemilih kelas untuk melihat mata pelajaran intrakurikuler.
				</p>
			{/if}
		</div>
		{#if ((page.data as { daftarKelas?: Array<{ id: number; nama: string; fase?: string | null }> }).daftarKelas ?? []).length > 1}
			{@const listKelas =
				(page.data as { daftarKelas?: Array<{ id: number; nama: string; fase?: string | null }> })
					.daftarKelas ?? []}
			<div class="relative flex w-full items-center sm:w-64">
				<select
					class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-semibold text-slate-900 transition-colors focus:border-blue-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
					title="Ganti Kelas"
					value={String(page.data.kelasAktif?.id ?? '')}
					onchange={(e) => {
						const val = (e.currentTarget as HTMLSelectElement).value;
						if (val) {
							const p = new URLSearchParams(page.url.search);
							p.set('kelas_id', val);
							window.location.search = p.toString();
						}
					}}
				>
					{#if page.data.kelasAktif?.id == null}
						<option value="" disabled selected>Pilih Kelas...</option>
					{/if}
					{#each listKelas as k (k.id)}
						<option value={String(k.id)}>{k.nama}{k.fase ? ` - ${k.fase}` : ''}</option>
					{/each}
				</select>
				<span
					aria-hidden="true"
					class="pointer-events-none absolute right-2.5 flex items-center text-slate-500 dark:text-zinc-400"
				>
					<Icon name="down" class="h-3.5 w-3.5" />
				</span>
			</div>
		{/if}
	</div>

	<div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
		<div
			class="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-800/50"
		>
			<div class="text-xs font-medium text-slate-500 dark:text-zinc-400">
				Mapel {getWajibLabel()}
			</div>
			<div class="mt-1 text-xl font-bold text-slate-900 tabular-nums dark:text-zinc-100">
				{hitunganJenis.wajib}
			</div>
		</div>
		{#if hitunganJenis.belum_dipetakan > 0}
			<div
				class="rounded-xl border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-900/60 dark:bg-amber-950/30"
			>
				<div class="text-xs font-medium text-amber-800 dark:text-amber-300">Belum Dipetakan</div>
				<div class="mt-1 text-xl font-bold text-amber-900 tabular-nums dark:text-amber-200">
					{hitunganJenis.belum_dipetakan}
				</div>
			</div>
		{/if}
		<div
			class="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-800/50"
		>
			<div class="text-xs font-medium text-slate-500 dark:text-zinc-400">Mapel Pilihan</div>
			<div class="mt-1 text-xl font-bold text-slate-900 tabular-nums dark:text-zinc-100">
				{hitunganJenis.pilihan}
			</div>
		</div>
		<div
			class="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-800/50"
		>
			<div class="text-xs font-medium text-slate-500 dark:text-zinc-400">Muatan Lokal</div>
			<div class="mt-1 text-xl font-bold text-slate-900 tabular-nums dark:text-zinc-100">
				{hitunganJenis.mulok}
			</div>
		</div>
		{#if shouldShowKejuruan()}
			<div
				class="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-800/50"
			>
				<div class="text-xs font-medium text-slate-500 dark:text-zinc-400">Kejuruan</div>
				<div class="mt-1 text-xl font-bold text-slate-900 tabular-nums dark:text-zinc-100">
					{hitunganJenis.kejuruan}
				</div>
			</div>
		{/if}
		{#if shouldShowPemberdayaan()}
			<div
				class="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-800/50"
			>
				<div class="text-xs font-medium text-slate-500 dark:text-zinc-400">
					Pemberdayaan &amp; Keterampilan
				</div>
				<div class="mt-1 text-xl font-bold text-slate-900 tabular-nums dark:text-zinc-100">
					{hitunganJenis.pemberdayaan}
				</div>
			</div>
		{/if}
		<div
			class="rounded-xl border border-blue-200/80 bg-blue-50/75 p-3 dark:border-blue-900/50 dark:bg-blue-950/35"
		>
			<div class="text-xs font-medium text-blue-700 dark:text-blue-300">Total Mapel</div>
			<div class="mt-1 text-xl font-bold text-blue-900 tabular-nums dark:text-blue-100">
				{totalMapel}
			</div>
		</div>
	</div>

	<div class="mt-4 flex flex-wrap items-start justify-between gap-2">
		{#if canEditUrutan && hasKelasAktif && !editUrutan}
			<button
				type="button"
				class="order-2 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 sm:order-1 sm:w-auto dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
				onclick={mulaiEditUrutan}
			>
				<Icon name="menu-drawer" class="h-4 w-4" />
				Edit Urutan
			</button>
		{:else if editUrutan}
			<form
				method="POST"
				action="?/simpan_urutan"
				class="order-2 flex w-full sm:order-1 sm:w-auto"
				use:enhance={() => {
					simpanUrutanPending = true;
					return async ({ result, update }) => {
						simpanUrutanPending = false;
						if (result.type === 'success') {
							await invalidate('app:mapel');
							batalEditUrutan();
							toast({
								message:
									(result.data as { success?: string } | undefined)?.success ??
									'Urutan mata pelajaran berhasil disimpan.',
								type: 'success'
							});
						} else if (result.type === 'failure') {
							toast({
								message:
									(result.data as { fail?: string } | undefined)?.fail ?? 'Gagal menyimpan urutan.',
								type: 'error'
							});
						} else {
							await update({ reset: false });
						}
					};
				}}
			>
				<input type="hidden" name="urutan" value={JSON.stringify(urutanList.map((m) => m.id))} />
				<button
					type="submit"
					class="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-l-xl bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
					disabled={simpanUrutanPending}
				>
					<Icon name="save" class="h-3.5 w-3.5" />
					Simpan
				</button>
				<button
					type="button"
					class="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-r-xl border border-red-300 bg-red-50 px-3.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300"
					disabled={simpanUrutanPending}
					onclick={batalEditUrutan}
				>
					<Icon name="close-sm" class="h-3.5 w-3.5" />
					Batal
				</button>
			</form>
		{/if}

		<div class="order-1 max-sm:w-full sm:order-2 sm:ml-auto">
			<div class="flex">
				<a
					class="inline-flex h-9 items-center justify-center gap-1.5 rounded-l-xl bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 max-sm:flex-1 {!canAddImportMapel
						? 'pointer-events-none opacity-50'
						: ''}"
					href={canAddImportMapel ? '/intrakurikuler/form' : '#'}
					use:modalRoute={canAddImportMapel ? 'add-mapel' : ''}
					aria-disabled={!canAddImportMapel}
				>
					<Icon name="plus" class="h-4 w-4" />
					Tambah Mapel
				</a>

				<!-- dropdown yang tergabung -->
				<div class="dropdown dropdown-end">
					<button
						title="Export dan Import mata pelajaran"
						type="button"
						tabindex="0"
						class="inline-flex h-9 items-center justify-center rounded-r-xl border-l border-blue-500 bg-blue-600 px-2.5 text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
						disabled={!canAddImportMapel}
						aria-disabled={!canAddImportMapel}
					>
						<Icon name="down" class="h-3.5 w-3.5" />
					</button>

					<!-- menu dropdown -->
					<ul
						tabindex="-1"
						class="dropdown-content menu z-50 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-1.5 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
					>
						<li>
							<button
								type="button"
								class={`w-full text-left ${!canAddImportMapel ? 'pointer-events-none opacity-50' : ''}`}
								disabled={!canAddImportMapel}
								aria-disabled={!canAddImportMapel}
								onclick={() => (importMapelOpen = true)}
							>
								<Icon name="import" />
								Impor Mapel
							</button>
						</li>
						<li>
							<button
								type="button"
								class={`w-full text-left ${!canAddImportMapel ? 'pointer-events-none opacity-50' : ''}`}
								disabled={!canAddImportMapel}
								aria-disabled={!canAddImportMapel}
								onclick={async () => {
									try {
										const resp = await fetch('/intrakurikuler/export_mapel', { method: 'GET' });
										if (!resp.ok) {
											const body = await resp.json().catch(() => ({}));
											return toast({
												message: body?.fail || 'Gagal mengekspor data.',
												type: 'error'
											});
										}
										const blob = await resp.blob();
										const url = URL.createObjectURL(blob);
										// prefer filename from Content-Disposition header set by server
										let filename = `mapel-${new Date().toISOString().slice(0, 10)}.xlsx`;
										try {
											const cd =
												resp.headers.get('content-disposition') ||
												resp.headers.get('Content-Disposition');
											if (cd) {
												// match filename*=UTF-8''encoded or filename="name"
												const mStar = cd.match(/filename\*=UTF-8''([^;\n\r]+)/i);
												const mBasic = cd.match(/filename="?([^";]+)"?/i);
												if (mStar && mStar[1]) filename = decodeURIComponent(mStar[1]);
												else if (mBasic && mBasic[1]) filename = mBasic[1];
											}
										} catch {
											/* ignore and fallback */
										}
										const a = document.createElement('a');
										a.href = url;
										a.download = filename;
										document.body.appendChild(a);
										a.click();
										a.remove();
										URL.revokeObjectURL(url);
									} catch (err) {
										console.error(err);
										toast({ message: 'Terjadi kesalahan saat mengekspor.', type: 'error' });
									}
								}}
							>
								<Icon name="export" />
								Ekspor Mapel
							</button>
						</li>
						<li>
							<form
								method="POST"
								action="?/tambah_pks"
								class="w-full"
								use:enhance={() => {
									toast({ message: 'Menambahkan mata pelajaran PKS...', type: 'info' });
									return async ({ result }) => {
										if (result.type === 'success') {
											await Promise.all([
												invalidate('app:mapel'),
												invalidate('app:asesmen-formatif')
											]);
											const data = result.data as { success?: string } | undefined;
											toast({
												message: data?.success || 'Mata pelajaran PKS berhasil ditambahkan.',
												type: 'success'
											});
										} else if (result.type === 'failure') {
											const data = result.data as { fail?: string } | undefined;
											toast({
												message: data?.fail || 'Gagal menambahkan mata pelajaran PKS.',
												type: 'error'
											});
										}
									};
								}}
							>
								<button
									type="submit"
									class={`flex w-full items-center gap-2 ${!canAddImportMapel || !hasKelasAktif ? 'pointer-events-none opacity-50' : ''}`}
									disabled={!canAddImportMapel || !hasKelasAktif}
									aria-disabled={!canAddImportMapel || !hasKelasAktif}
								>
									<Icon name="plus" />
									<span>Tambah PKS</span>
								</button>
							</form>
						</li>
						<li>
							<form
								method="POST"
								action="?/tambah_agama"
								class="w-full"
								use:enhance={() => {
									toast({ message: 'Menambahkan mata pelajaran Agama...', type: 'info' });
									return async ({ result }) => {
										if (result.type === 'success') {
											await Promise.all([
												invalidate('app:mapel'),
												invalidate('app:asesmen-formatif')
											]);
											const data = result.data as { success?: string } | undefined;
											toast({
												message: data?.success || 'Mata pelajaran Agama berhasil ditambahkan.',
												type: 'success'
											});
										} else if (result.type === 'failure') {
											const data = result.data as { fail?: string } | undefined;
											toast({
												message: data?.fail || 'Gagal menambahkan mata pelajaran Agama.',
												type: 'error'
											});
										}
									};
								}}
							>
								<button
									type="submit"
									class={`flex w-full items-center gap-2 ${!canAddImportMapel || !hasKelasAktif ? 'pointer-events-none opacity-50' : ''}`}
									disabled={!canAddImportMapel || !hasKelasAktif}
									aria-disabled={!canAddImportMapel || !hasKelasAktif}
								>
									<Icon name="plus" />
									<span>Tambah Agama</span>
								</button>
							</form>
						</li>
						<li>
							<form
								method="POST"
								action="?/tambah_mapel_umum"
								class="w-full"
								use:enhance={() => {
									toast({ message: 'Menerapkan mata pelajaran umum...', type: 'info' });
									return async ({ result }) => {
										if (result.type === 'success') {
											await Promise.all([
												invalidate('app:mapel'),
												invalidate('app:asesmen-formatif'),
												invalidate('app:asesmen-sumatif')
											]);
											const data = result.data as { success?: string } | undefined;
											toast({
												message: data?.success || 'Mata pelajaran umum berhasil diterapkan.',
												type: 'success'
											});
										} else if (result.type === 'failure') {
											const data = result.data as { fail?: string } | undefined;
											toast({
												message: data?.fail || 'Gagal menerapkan mata pelajaran umum.',
												type: 'error'
											});
										}
									};
								}}
							>
								<button
									type="submit"
									class="flex w-full items-center gap-2 font-semibold text-blue-600 dark:text-blue-400"
									title="Terapkan 13 mata pelajaran umum standar ke kelas / semua kelas"
								>
									<Icon name="layers" />
									<span>Terapkan Mapel Umum</span>
								</button>
							</form>
						</li>
					</ul>
				</div>
			</div>
		</div>
	</div>

	{#if !hasKelasAktif}
		<div
			class="mt-4 flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
		>
			<Icon name="info" class="h-4 w-4 shrink-0" />
			<span>Pilih kelas aktif agar daftar mata pelajaran dapat ditampilkan.</span>
		</div>
	{/if}

	{#if hasKelasAktif && totalMapel === 0}
		<div
			class="mt-4 flex items-center gap-2.5 rounded-xl border border-blue-200/80 bg-blue-50/75 px-3.5 py-3 text-xs text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/35 dark:text-blue-200"
		>
			<Icon name="info" class="h-4 w-4 shrink-0" />
			<span
				>Belum ada data mata pelajaran untuk kelas ini. Gunakan tombol &ldquo;Tambah Mapel&rdquo; di
				atas.</span
			>
		</div>
	{/if}

	<div
		class="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
	>
		<table class="w-full border-collapse text-xs">
			<thead>
				<tr
					class="border-b border-slate-200 bg-slate-50 text-left font-semibold text-slate-700 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300"
				>
					{#if editUrutan}
						<th class="px-3 py-2.5 text-center" style="width: 48px;" title="Urutkan">
							<Icon name="menu-drawer" class="h-4 w-4" />
						</th>
					{/if}
					<th class="px-3 py-2.5" style="width: 60px;">No</th>
					<th class="px-3 py-2.5" style="min-width: 240px;">Mata Pelajaran</th>
					<th class="px-3 py-2.5" style="min-width: 150px;">Jenis Mapel</th>
					<th class="px-3 py-2.5" style="width: 120px;">Kode</th>
					<th class="px-3 py-2.5" style="width: 100px;">KKM</th>
					<th class="px-3 py-2.5" style="width: 180px;">Tujuan Pembelajaran</th>
					<th class="px-3 py-2.5 text-center">Aksi</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-200 dark:divide-zinc-800">
				{#each barisTampil as mapel, index (mapel.id)}
					<tr
						draggable={editUrutan}
						data-mapel-id={editUrutan ? mapel.id : undefined}
						class="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 {editUrutan
							? `${dragIndex === index ? 'opacity-40' : 'cursor-grab'} active:cursor-grabbing`
							: ''}"
						animate:flip={{ duration: 200 }}
						ondragstart={(e) => handleDragStart(index, e)}
						ondragover={handleDragOver}
						ondragend={() => (dragIndex = null)}
						ondrop={() => handleDrop(index)}
						use:touchDragSource={{
							enabled: editUrutan,
							dragData: () => ({ kode: String(index) }),
							live: true,
							onDragStart: () => {
								dragIndex = index;
							},
							onDragOver: (target) => reorderHover(target)
						}}
						use:dropTarget={{ enabled: editUrutan }}
					>
						{#if editUrutan}
							<td class="px-3 py-2.5 text-center">
								<span
									class="inline-flex cursor-grab items-center justify-center text-slate-500 dark:text-zinc-400"
									title="Tarik untuk mengurutkan"
								>
									<Icon name="chevron-up-down" class="h-4 w-4" />
								</span>
							</td>
						{/if}
						<td class="px-3 py-2.5 text-slate-600 tabular-nums dark:text-zinc-400">{index + 1}</td>
						<td class="px-3 py-2.5 font-semibold text-slate-900 dark:text-zinc-100">
							{mapel.namaLokal || mapel.nama}
							{#if mapel.keteranganDapodik}
								<p class="mt-0.5 text-[11px] font-normal text-slate-500 dark:text-zinc-400">
									{mapel.keteranganDapodik}
								</p>
							{/if}
						</td>
						<td class="px-3 py-2.5 whitespace-nowrap text-slate-700 dark:text-zinc-300"
							>{jenisMapel[mapel.jenis ?? 'wajib']}</td
						>
						<td class="px-3 py-2.5 font-mono text-xs text-slate-700 dark:text-zinc-300"
							>{mapel.kode ?? (mapel.nama === agamaParentName ? 'PAPB' : '-')}</td
						>
						<td class="px-3 py-2.5 text-slate-700 tabular-nums dark:text-zinc-300"
							>{formatKkm(mapel.kkm)}</td
						>
						<td class="px-3 py-2.5">
							{#if canManageMapel}
								<a
									class="inline-flex h-8 items-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-2.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
									href={`/intrakurikuler/${mapel.editTpMapelId ?? mapel.id}/tp-rl`}
								>
									<span
										class="h-2 w-2 rounded-full {mapel.tpCount > 0
											? 'bg-emerald-600'
											: 'bg-red-500'}"
										title={mapel.tpCount > 0 ? 'TP sudah diisi' : 'Masih ada TP yang belum diisi'}
										aria-label={`Status tujuan pembelajaran: ${
											mapel.tpCount > 0 ? 'sudah terisi' : 'belum terisi'
										}`}
										role="status"
									></span>
									<Icon name="edit" class="h-3.5 w-3.5" />
									Edit TP
								</a>
							{:else}
								<button
									type="button"
									class="inline-flex h-8 cursor-not-allowed items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100 px-2.5 text-xs font-semibold text-slate-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500"
									disabled
									aria-disabled="true"
									title="Anda tidak memiliki izin untuk mengedit"
								>
									<span
										class="h-2 w-2 rounded-full {mapel.tpCount > 0
											? 'bg-emerald-600'
											: 'bg-red-500'}"
										aria-hidden="true"
									></span>
									<Icon name="edit" class="h-3.5 w-3.5" />
									Edit TP
								</button>
							{/if}
						</td>
						<td class="px-3 py-2.5">
							<div class="flex flex-row items-center justify-center">
								{#if canManageMapel}
									<a
										class="inline-flex h-8 items-center gap-1 rounded-l-lg border border-slate-200 bg-white px-2.5 text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
										href={`/intrakurikuler/${mapel.id}/edit`}
										title={data.adaDataDapodik && agamaMapelNameSet.has(mapel.nama)
											? mapel.dapodikIndukPembelajaranId
												? 'Edit data mata pelajaran (Mata Pelajaran Induk sudah disetel)'
												: 'Edit data mata pelajaran (Mata Pelajaran Induk belum disetel)'
											: 'Edit data mata pelajaran'}
										use:modalRoute={'edit-mapel'}
									>
										{#if data.adaDataDapodik && agamaMapelNameSet.has(mapel.nama)}
											<span
												class="h-2 w-2 rounded-full {mapel.dapodikIndukPembelajaranId
													? 'bg-emerald-600'
													: 'bg-red-500'}"
												aria-hidden="true"
											></span>
										{/if}
										<Icon name="edit" class="h-3.5 w-3.5" />
									</a>
									<a
										class="inline-flex h-8 w-8 items-center justify-center rounded-r-lg border-y border-r border-slate-200 bg-red-50 text-red-700 transition-colors hover:bg-red-100 dark:border-zinc-700 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950"
										href={`/intrakurikuler/${mapel.id}/delete`}
										title="Hapus mata pelajaran"
										use:modalRoute={'delete-mapel'}
										onclick={(event) => handleDeleteClick(event, mapel)}
									>
										<Icon name="del" class="h-3.5 w-3.5" />
									</a>
								{:else}
									<button
										type="button"
										class="inline-flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-l-lg border border-slate-200 bg-slate-100 text-slate-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500"
										disabled
										aria-disabled="true"
										title="Anda tidak memiliki izin untuk mengedit"
									>
										<Icon name="edit" class="h-3.5 w-3.5" />
									</button>
									<button
										type="button"
										class="inline-flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-r-lg border-y border-r border-slate-200 bg-slate-100 text-slate-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500"
										disabled
										aria-disabled="true"
										title="Anda tidak memiliki izin untuk menghapus"
									>
										<Icon name="del" class="h-3.5 w-3.5" />
									</button>
								{/if}
							</div>
						</td>
					</tr>
				{:else}
					<tr>
						<td
							class="px-3 py-8 text-center text-slate-500 dark:text-zinc-400"
							colspan={editUrutan ? 8 : 7}
						>
							{emptyStateMessage}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

<IntrakurikulerModals />
<ImportMapelDialog bind:open={importMapelOpen} adaDataDapodik={data.adaDataDapodik} />

<style>
	/* Baris drag-and-drop: background di level sel agar ghost drag punya bg + sudut
	   membulat (radius di <tr> tidak bekerja pada border-collapse: collapse). */
	tbody tr[draggable='true'] > td {
		background-color: var(--color-base-100);
		border-radius: 0;
	}
	tbody tr[draggable='true'] > td:first-child {
		border-start-start-radius: 0.5rem;
		border-end-start-radius: 0.5rem;
	}
	tbody tr[draggable='true'] > td:last-child {
		border-start-end-radius: 0.5rem;
		border-end-end-radius: 0.5rem;
	}
</style>
