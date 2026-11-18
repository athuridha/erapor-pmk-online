<script lang="ts">
	import type { PageData } from './$types';
	import Icon from '$lib/components/icon.svelte';
	import { getHariSekolahList } from '$lib/hari-sekolah';

	type BellSettingsRow = typeof import('$lib/server/db/schema').tableBellSettings.$inferSelect;
	type KegiatanCustomRow = typeof import('$lib/server/db/schema').tableKegiatanCustom.$inferSelect;
	type JadwalPelajaranRow =
		typeof import('$lib/server/db/schema').tableJadwalPelajaran.$inferSelect;

	const { data } = $props<{ data: PageData }>();

	const bellSettings = $derived(data.bellSettings as BellSettingsRow | null);
	const kegiatanCustom = $derived(data.kegiatanCustom as KegiatanCustomRow[]);
	const jadwalPelajaran = $derived(data.jadwalPelajaran as JadwalPelajaranRow[]);
	const daftarKodeMapel = $derived(data.daftarKodeMapel as string[]);
	const daftarKodeKokurikuler = $derived(data.daftarKodeKokurikuler as string[]);

	const daftarKelas = $derived((data.daftarKelas ?? []) as Array<{ id: number; nama: string }>);

	const hariLabel: Record<string, string> = {
		senin: 'Senin',
		selasa: 'Selasa',
		rabu: 'Rabu',
		kamis: 'Kamis',
		jumat: 'Jumat',
		sabtu: 'Sabtu'
	};

	const hariSekolah = $derived((data.hariSekolah as number) ?? 6);
	const hariSekolahCustom = $derived((data.hariSekolahCustom as string | null) ?? null);
	const hariList = $derived(getHariSekolahList(hariSekolah, hariSekolahCustom));

	const kodeTambahan = ['UPB', 'IST', 'PLG'];

	const kodeNamaMap = $derived(
		new Map<string, string>([
			['UPB', 'Upacara'],
			['IST', 'Istirahat'],
			['PLG', 'Pulang'],
			...kegiatanCustom.map((k) => [k.kode, k.nama] as [string, string]),
			...daftarKodeKokurikuler.map((k) => [k, k] as [string, string])
		])
	);

	const badgeColors = [
		'border-slate-200/80 bg-slate-100 text-slate-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200',
		'border-blue-200/80 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/50 dark:text-blue-300',
		'border-indigo-200/80 bg-indigo-50 text-indigo-700 dark:border-indigo-900/50 dark:bg-indigo-950/50 dark:text-indigo-300',
		'border-violet-200/80 bg-violet-50 text-violet-700 dark:border-violet-900/50 dark:bg-violet-950/50 dark:text-violet-300',
		'border-sky-200/80 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/50 dark:text-sky-300',
		'border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300',
		'border-amber-200/80 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300',
		'border-rose-200/80 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300'
	];

	const badgeColorMap: Record<string, string> = $derived.by(() => {
		const allKodes = new Set<string>(kodeTambahan);
		for (const kd of kegiatanCustom) allKodes.add((kd as { kode: string }).kode);
		for (const kode of daftarKodeMapel) allKodes.add(kode);
		for (const kode of daftarKodeKokurikuler) allKodes.add(kode);
		const sorted = [...allKodes].sort();
		const map: Record<string, string> = {};
		sorted.forEach((kode, i) => {
			if (kode === 'UPB') {
				map[kode] =
					'border-amber-200/80 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300';
			} else if (kode === 'IST') {
				map[kode] =
					'border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300';
			} else if (kode === 'PLG') {
				map[kode] =
					'border-rose-200/80 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300';
			} else {
				map[kode] = badgeColors[i % badgeColors.length];
			}
		});
		return map;
	});

	const jadwalMatrix = $derived.by(() => {
		const matrix: Record<string, Record<number, Record<number, string>>> = {};
		for (const entry of jadwalPelajaran) {
			if (!matrix[entry.hari]) matrix[entry.hari] = {};
			if (!matrix[entry.hari][entry.jamKe]) matrix[entry.hari][entry.jamKe] = {};
			matrix[entry.hari][entry.jamKe][entry.kelasId] = entry.kodeKegiatan;
		}
		return matrix;
	});

	const kelasTerurut = $derived(
		[...daftarKelas].sort((a, b) => {
			const aNum = parseInt(a.nama.replace(/\D/g, '')) || 0;
			const bNum = parseInt(b.nama.replace(/\D/g, '')) || 0;
			return aNum - bNum;
		})
	);

	const kodeMerged = $derived(
		new Set(['UPB', 'IST', 'PLG', ...kegiatanCustom.map((k) => (k as { kode: string }).kode)])
	);
	const customDurationMap = $derived(
		new Map(kegiatanCustom.map((k) => [k.kode, (k as { durasi: number | null }).durasi]))
	);

	function timeToMinutes(t: string): number {
		const [h, m] = t.split(':').map(Number);
		return h * 60 + m;
	}

	function minutesToTime(m: number): string {
		const h = Math.floor(m / 60);
		const min = m % 60;
		return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
	}

	function getDurasiKode(kode: string, defaultDur: number): number {
		if (kode === 'UPB') return bellSettings?.durasiUpacara ?? 70;
		if (kode === 'IST') return bellSettings?.durasiIstirahat ?? 30;
		const customDur = customDurationMap.get(kode);
		if (customDur != null) return customDur;
		return defaultDur;
	}

	function computeWaktu(
		hari: string,
		jamKe: number,
		daySchedule?: Record<number, Record<number, string>>
	): { start: string; end: string } {
		const s = bellSettings;
		const jamMulai = s?.jamMulai ?? '07:00';
		const jamPelajaranMenit = s?.jamPelajaranMenit ?? 35;
		const jamMulaiMinutes = timeToMinutes(jamMulai);
		const ds = daySchedule ?? jadwalMatrix[hari] ?? {};

		let currentMinutes = jamMulaiMinutes;
		for (let prevJamKe = 1; prevJamKe < jamKe; prevJamKe++) {
			const prevCodes = kelasTerurut.map((k) => ds[prevJamKe]?.[k.id] ?? '');
			const uniquePrev = [...new Set(prevCodes.filter(Boolean))];
			let dur = jamPelajaranMenit;
			if (uniquePrev.length === 1) {
				dur = getDurasiKode(uniquePrev[0], dur);
			}
			currentMinutes += dur;
		}

		const codes = kelasTerurut.map((k) => ds[jamKe]?.[k.id] ?? '');
		const unique = [...new Set(codes.filter(Boolean))];
		let dur = jamPelajaranMenit;
		if (unique.length === 1) {
			dur = getDurasiKode(unique[0], dur);
		}

		return { start: minutesToTime(currentMinutes), end: minutesToTime(currentMinutes + dur) };
	}

	const maxJam = $derived.by(() => {
		const jamPelajaranMenit = bellSettings?.jamPelajaranMenit ?? 35;
		const jamMulaiMinutes = timeToMinutes(bellSettings?.jamMulai ?? '07:00');
		const jamPulangMinutes = timeToMinutes((data.jamPulang as string) ?? '15:00');
		const raw = (jamPulangMinutes - jamMulaiMinutes) / jamPelajaranMenit;
		const calculated = Math.max(1, Math.floor(raw));
		let maxFromData = 0;
		for (const hari of hariList) {
			const daySchedule = jadwalMatrix[hari];
			if (daySchedule) {
				const periods = Object.keys(daySchedule).map(Number);
				if (periods.length > 0) {
					maxFromData = Math.max(maxFromData, ...periods);
				}
			}
		}
		return Math.max(calculated, maxFromData) + 1;
	});

	const waktuMatrix = $derived.by(() => {
		const m: Record<string, Record<number, { start: string; end: string }>> = {};
		for (const hari of hariList) {
			m[hari] = {};
			const daySchedule = jadwalMatrix[hari] ?? {};
			for (let jamKe = 1; jamKe <= maxJam; jamKe++) {
				m[hari][jamKe] = computeWaktu(hari, jamKe, daySchedule);
			}
		}
		return m;
	});

	function computePlgAutoJam(hari: string): number {
		const jamPulangMinutes = timeToMinutes((data.jamPulang as string) ?? '15:00');
		for (let j = maxJam; j >= 1; j--) {
			const waktu = waktuMatrix[hari]?.[j];
			if (waktu) {
				const startMinutes = timeToMinutes(waktu.start);
				if (startMinutes < jamPulangMinutes) {
					return j;
				}
			}
		}
		return 1;
	}

	const hariMaxJam = $derived.by(() => {
		const m: Record<string, number> = {};
		for (const hari of hariList) {
			m[hari] = computePlgAutoJam(hari);
		}
		return m;
	});

	function getKode(hari: string, jamKe: number, kelasId: number): string {
		if (jamKe === hariMaxJam[hari]) return 'PLG';
		return jadwalMatrix[hari]?.[jamKe]?.[kelasId] ?? '';
	}

	function isAllSame(hari: string, jamKe: number): string | null {
		const codes = kelasTerurut.map((k) => getKode(hari, jamKe, k.id));
		const unique = [...new Set(codes.filter(Boolean))];
		if (unique.length === 1) return unique[0];
		return null;
	}

	function formatHari(hari: string): string {
		return hariLabel[hari] ?? hari.charAt(0).toUpperCase() + hari.slice(1);
	}
</script>

<svelte:head>
	<title>Jadwal Pelajaran</title>
</svelte:head>

<div class="mx-auto w-full max-w-7xl">
	<section
		class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
	>
		<div class="space-y-5">
			<div class="border-b border-slate-100 pb-4 dark:border-zinc-800">
				<h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
					Jadwal Pelajaran
				</h1>
				{#if data.namaSekolah}
					<p class="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">{data.namaSekolah}</p>
				{/if}
			</div>

			{#if kelasTerurut.length === 0}
				<div
					class="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 py-12 text-center text-slate-500 dark:border-zinc-800 dark:bg-zinc-800/40 dark:text-zinc-400"
				>
					<Icon name="info" class="mb-2 h-7 w-7 text-slate-400 dark:text-zinc-500" />
					<p class="text-xs font-medium">Belum ada data jadwal pelajaran</p>
				</div>
			{:else}
				<div
					class="overflow-x-auto rounded-xl border border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900"
				>
					<table class="w-full border-collapse text-xs">
						<thead class="sticky top-0 z-10">
							<tr
								class="border-b border-slate-200/80 bg-slate-50 text-left font-semibold text-slate-600 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300"
							>
								<th
									rowspan="2"
									class="w-0 border-r border-slate-200/80 px-3 py-2.5 dark:border-zinc-700">Hari</th
								>
								<th
									rowspan="2"
									class="w-0 border-r border-slate-200/80 px-3 py-2.5 text-center dark:border-zinc-700"
									>Jam</th
								>
								<th
									rowspan="2"
									class="w-0 border-r border-slate-200/80 px-3 py-2.5 dark:border-zinc-700"
									>Waktu</th
								>
								<th colspan={kelasTerurut.length} class="px-3 py-2 text-center">Kelas</th>
							</tr>
							<tr
								class="border-b border-slate-200/80 bg-slate-50 text-left font-semibold text-slate-600 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300"
							>
								{#each kelasTerurut as kelas (kelas.id)}
									<th
										class="min-w-[70px] max-w-[15ch] truncate border-l border-slate-200/60 px-2.5 py-2 text-center dark:border-zinc-700/70"
										title={kelas.nama}
									>
										{kelas.nama.slice(0, 15)}{kelas.nama.length > 15 ? '…' : ''}
									</th>
								{/each}
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-100 dark:divide-zinc-800/80">
							{#each hariList as hari (hari)}
								{#each Array.from({ length: hariMaxJam[hari] }, (_, i) => i + 1) as jamKe (jamKe)}
									{@const allSame = isAllSame(hari, jamKe)}
									{@const waktu = waktuMatrix[hari]?.[jamKe] ?? {
										start: '--:--',
										end: '--:--'
									}}
									<tr class="transition-colors hover:bg-slate-50/70 dark:hover:bg-zinc-800/40">
										{#if jamKe === 1}
											<td
												rowspan={hariMaxJam[hari]}
												class="border-r border-slate-200/70 px-3 py-2 align-top font-semibold text-slate-800 dark:border-zinc-800 dark:text-zinc-200"
											>
												{formatHari(hari)}
											</td>
										{/if}
										<td
											class="border-r border-slate-200/60 px-3 py-2 text-center text-slate-600 dark:border-zinc-800 dark:text-zinc-300"
										>
											{jamKe}
										</td>
										<td
											class="border-r border-slate-200/70 px-3 py-2 whitespace-nowrap text-slate-600 dark:border-zinc-800 dark:text-zinc-300"
										>
											{#if jamKe === hariMaxJam[hari]}
												{waktu.start}
											{:else}
												{waktu.start} - {waktu.end}
											{/if}
										</td>
										{#if allSame !== null && kodeMerged.has(allSame)}
											<td
												colspan={kelasTerurut.length}
												class="px-2.5 py-1.5 text-center align-middle"
											>
												<div class="flex h-full w-full items-center justify-center">
													<span
														class="inline-flex w-full items-center justify-center rounded-lg border px-2 py-1 text-[11px] font-semibold {badgeColorMap[
															allSame
														] ??
															'border-blue-200/80 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/50 dark:text-blue-300'}"
													>
														{kodeNamaMap.get(allSame) ?? allSame}
													</span>
												</div>
											</td>
										{:else}
											{#each kelasTerurut as kelas (kelas.id)}
												{@const kode = getKode(hari, jamKe, kelas.id)}
												<td
													class="border-l border-slate-100 px-2 py-1.5 text-center dark:border-zinc-800/80"
												>
													{#if kode}
														<span
															class="inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold {badgeColorMap[
																kode
															] ??
																'border-blue-200/80 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/50 dark:text-blue-300'}"
															>{kodeNamaMap.get(kode) ?? kode}</span
														>
													{:else}
														<span class="text-slate-300 dark:text-zinc-600">-</span>
													{/if}
												</td>
											{/each}
										{/if}
									</tr>
								{/each}
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	</section>
</div>
