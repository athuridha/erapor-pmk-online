<script lang="ts">
	import { onDestroy } from 'svelte';
	import { toast } from '$lib/components/toast.svelte';
	import Icon from '$lib/components/icon.svelte';
	import { isValidTime } from '$lib/utils';

	type SoundStep = { tipe: string; delay: number };
	type SimEvent = {
		timeLabel: string;
		jamKe: number;
		kode: string;
		description: string;
		soundSteps: SoundStep[];
	};

	interface Props {
		hariList: string[];
		formatHari: (hari: string) => string;
		maxJam: number;
		kelasTerurut: Array<{ id: number; nama: string }>;
		isAllSame: (hari: string, jamKe: number) => string | null;
		getKode: (hari: string, jamKe: number, kelasId: number) => string;
		computeWaktu: (hari: string, jamKe: number) => { start: string; end: string };
		timeToMinutes: (t: string) => number;
		kegiatanCustom: Array<{
			kode: string;
			nama: string;
			durasi?: number | null;
			soundFileName?: string | null;
		}>;
		daftarKodeMapel: string[];
		isFirstSubjectPeriod: (today: string, jamKe: number) => boolean;
	}

	let {
		hariList,
		formatHari,
		maxJam,
		kelasTerurut,
		isAllSame,
		getKode,
		computeWaktu,
		timeToMinutes,
		kegiatanCustom,
		daftarKodeMapel,
		isFirstSubjectPeriod
	}: Props = $props();

	function getDefaultHari() {
		return hariList[0] ?? 'senin';
	}
	let simulasiHari = $state(getDefaultHari());
	let simulasiJam = $state('07:00');
	let simulasiRunning = $state(false);
	let currentEventIndex = $state(-1);
	let timer: ReturnType<typeof setTimeout> | null = null;

	let events: SimEvent[] = $state([]);
	let filteredEvents: SimEvent[] = $derived(
		events.filter((e) => timeToMinutes(e.timeLabel) >= timeToMinutes(simulasiJam))
	);

	onDestroy(() => {
		stopSimulasi();
	});

	function getFirstKode(jamKe: number): string | null {
		const kode = isAllSame(simulasiHari, jamKe);
		if (kode) return kode;
		return kelasTerurut.map((k) => getKode(simulasiHari, jamKe, k.id)).find(Boolean) ?? null;
	}

	function buildEvents(): SimEvent[] {
		const result: SimEvent[] = [];
		for (let jamKe = 1; jamKe <= maxJam; jamKe++) {
			const kode = getFirstKode(jamKe);
			if (!kode) continue;
			const waktu = computeWaktu(simulasiHari, jamKe);
			if (!waktu) continue;
			const endMin = timeToMinutes(waktu.end);

			if (jamKe > 1) {
				const prevKode = isAllSame(simulasiHari, jamKe - 1);
				if (prevKode === 'IST') {
					result.push({
						timeLabel: waktu.start,
						jamKe,
						kode,
						description: 'Bell → Selesai Istirahat',
						soundSteps: [
							{ tipe: 'custom', delay: 0 },
							{ tipe: 'selesai_istirahat', delay: 1500 }
						]
					});
					continue;
				}
			}

			let desc: string;
			// sengaja tanpa nilai awal: cabang if/else di bawah selalu menetapkan nilai
			let extraTipe: string | null;
			if (kode === 'UPB') {
				extraTipe = 'upacara';
				desc = 'Bell → Upacara';
			} else if (kode === 'IST') {
				extraTipe = 'istirahat';
				desc = 'Bell → Istirahat';
			} else if (kode === 'PLG') {
				extraTipe = 'pulang';
				desc = 'Bell → Pulang';
			} else if (kegiatanCustom.some((k) => k.kode === kode)) {
				const kcg = kegiatanCustom.find((k) => k.kode === kode);
				const nama = kcg?.nama ?? kode;
				extraTipe = kcg?.soundFileName ? `custom_${kode}` : 'pergantian';
				desc = `Bell → ${nama}`;
			} else if (daftarKodeMapel.includes(kode)) {
				extraTipe = isFirstSubjectPeriod(simulasiHari, jamKe) ? 'masuk' : 'pergantian';
				desc = `Bell → ${extraTipe === 'masuk' ? 'Masuk' : 'Pergantian'}`;
			} else {
				extraTipe = 'pergantian';
				desc = 'Bell → Pergantian';
			}

			result.push({
				timeLabel: waktu.start,
				jamKe,
				kode,
				description: desc,
				soundSteps: [
					{ tipe: 'custom', delay: 0 },
					...(extraTipe ? [{ tipe: extraTipe, delay: 1500 }] : [])
				]
			});

			if (daftarKodeMapel.includes(kode)) {
				if (jamKe === maxJam) {
					result.push({
						timeLabel: waktu.end,
						jamKe,
						kode,
						description: 'Bell → Pulang',
						soundSteps: [{ tipe: 'pulang', delay: 0 }]
					});
				} else {
					const nextJamKe = jamKe + 1;
					let isAdjacent = false;
					if (nextJamKe <= maxJam) {
						const nextKode =
							isAllSame(simulasiHari, nextJamKe) ??
							kelasTerurut.map((k) => getKode(simulasiHari, nextJamKe, k.id)).find(Boolean);
						if (nextKode) {
							const nextWaktu = computeWaktu(simulasiHari, nextJamKe);
							if (nextWaktu && timeToMinutes(nextWaktu.start) === endMin) {
								isAdjacent = true;
							}
						}
					}
					if (!isAdjacent) {
						result.push({
							timeLabel: waktu.end,
							jamKe,
							kode,
							description: 'Pergantian',
							soundSteps: [{ tipe: 'pergantian', delay: 0 }]
						});
					}
				}
			}
		}
		return result;
	}

	async function playSound(tipe: string) {
		try {
			const res = await fetch('/api/bell/play', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ tipe })
			});
			if (!res.ok) {
				const err = await res.json().catch(() => ({ fail: 'Gagal memutar sound' }));
				throw new Error(err.fail ?? `Error ${res.status}`);
			}
		} catch (e) {
			console.error('[simulasi] Gagal memutar sound:', e);
		}
	}

	function startSimulasi() {
		stopSimulasi();
		if (!isValidTime(simulasiJam)) {
			toast('Format jam tidak valid (HH:mm)', 'warning');
			return;
		}
		events = buildEvents();
		if (filteredEvents.length === 0) {
			toast('Tidak ada jadwal tersisa untuk hari ini.', 'info');
			return;
		}
		const firstIdx = events.findIndex(
			(e) => timeToMinutes(e.timeLabel) >= timeToMinutes(simulasiJam)
		);
		if (firstIdx < 0) return;
		currentEventIndex = firstIdx;
		simulasiRunning = true;
		fireCurrentEvent();
	}

	function fireCurrentEvent() {
		if (currentEventIndex >= events.length) {
			simulasiRunning = false;
			toast('Simulasi selesai, semua event telah diputar.', 'success');
			return;
		}
		const event = events[currentEventIndex];
		for (const step of event.soundSteps) {
			setTimeout(() => playSound(step.tipe), step.delay);
		}
		const maxDelay = Math.max(...event.soundSteps.map((s) => s.delay), 0);
		timer = setTimeout(() => {
			currentEventIndex++;
			timer = setTimeout(fireCurrentEvent, 1500);
		}, maxDelay + 5000);
	}

	function stopSimulasi() {
		if (timer) {
			clearTimeout(timer);
			timer = null;
		}
		simulasiRunning = false;
		currentEventIndex = -1;
	}

	function jumpToEvent(idx: number) {
		if (!simulasiRunning && idx >= 0 && idx < events.length) {
			stopSimulasi();
			currentEventIndex = idx;
			simulasiRunning = true;
			fireCurrentEvent();
		}
	}

	const visibleEvents = $derived(events.length > 20 ? filteredEvents.slice(0, 20) : filteredEvents);
	const totalCount = $derived(filteredEvents.length);
</script>

<div class="not-prose flex flex-col gap-4">
	<div class="flex flex-wrap items-end gap-3">
		<label class="flex flex-1 flex-col gap-1.5">
			<span class="text-xs font-medium text-slate-700 dark:text-zinc-300">Hari</span>
			<div class="relative flex items-center">
				<select
					class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
					bind:value={simulasiHari}
					disabled={simulasiRunning}
				>
					{#each hariList as h (h)}
						<option value={h}>{formatHari(h)}</option>
					{/each}
				</select>
				<span
					aria-hidden="true"
					class="pointer-events-none absolute right-2.5 flex items-center text-slate-400 dark:text-zinc-400"
				>
					<Icon name="down" class="h-3.5 w-3.5" />
				</span>
			</div>
		</label>
		<label class="flex flex-1 flex-col gap-1.5">
			<span class="text-xs font-medium text-slate-700 dark:text-zinc-300">Mulai Jam</span>
			<input
				type="text"
				class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
				bind:value={simulasiJam}
				disabled={simulasiRunning}
				pattern="[0-9]{2}:[0-9]{2}"
				inputmode="numeric"
				placeholder="HH:mm"
			/>
		</label>
		<div class="flex gap-2">
			{#if simulasiRunning}
				<button
					type="button"
					class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-red-200/80 bg-red-50 px-3.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950"
					onclick={stopSimulasi}
				>
					<Icon name="pause" class="h-3.5 w-3.5" />
					Hentikan
				</button>
			{:else}
				<button
					type="button"
					class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
					onclick={startSimulasi}
				>
					<Icon name="play" class="h-3.5 w-3.5" />
					Mulai Simulasi
				</button>
			{/if}
		</div>
	</div>

	<div
		class="flex flex-col rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 text-xs dark:border-zinc-800 dark:bg-zinc-800/50"
	>
		<div class="mb-2.5 flex items-center justify-between">
			<span
				class="text-[11px] font-semibold tracking-wider text-slate-500 uppercase dark:text-zinc-400"
			>
				Event {currentEventIndex >= 0 ? currentEventIndex + 1 : 0} / {totalCount}
			</span>
			{#if simulasiRunning && currentEventIndex >= 0 && currentEventIndex < events.length}
				<span class="inline-flex items-center gap-1 font-medium text-blue-600 dark:text-blue-400">
					<Icon name="play" class="h-3.5 w-3.5" />
					{events[currentEventIndex].description}
				</span>
			{/if}
		</div>

		<div class="flex flex-col gap-1">
			{#each visibleEvents as event (event.timeLabel + event.kode + event.description)}
				{@const globalIdx = events.indexOf(event)}
				{@const isDone = globalIdx < currentEventIndex}
				{@const isCurrent = globalIdx === currentEventIndex}
				<button
					type="button"
					class="flex w-full items-center justify-start gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors {isCurrent
						? 'border-blue-500 bg-blue-50 text-blue-900 dark:border-blue-600 dark:bg-blue-950/50 dark:text-blue-200'
						: isDone
							? 'border-transparent text-slate-400 dark:text-zinc-500'
							: 'border-transparent text-slate-700 hover:bg-slate-100/80 dark:text-zinc-200 dark:hover:bg-zinc-800'}"
					onclick={() => {
						if (!simulasiRunning && !isDone) jumpToEvent(globalIdx);
					}}
					disabled={simulasiRunning || isDone}
				>
					<span
						class="inline-flex w-4 items-center justify-center {isDone
							? 'text-emerald-600 dark:text-emerald-400'
							: isCurrent
								? 'text-blue-600 dark:text-blue-400'
								: ''}"
					>
						{#if isDone}
							<Icon name="check" class="h-3.5 w-3.5" />
						{:else if isCurrent}
							<Icon name="play" class="h-3.5 w-3.5" />
						{/if}
					</span>
					<span class="font-mono text-xs">{event.timeLabel}</span>
					<span class="font-mono text-[10px] text-slate-400 dark:text-zinc-500"
						>jm-{event.jamKe}</span
					>
					<span class="truncate">{event.description}</span>
				</button>
			{/each}
			{#if filteredEvents.length > 20}
				<span class="mt-1.5 text-center text-[11px] text-slate-400 dark:text-zinc-500">
					... dan {filteredEvents.length - 20} event lainnya
				</span>
			{/if}
		</div>
	</div>
</div>
