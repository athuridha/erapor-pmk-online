<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { hideModal, updateModal } from '$lib/components/global-modal.svelte';
	import { toast } from '$lib/components/toast.svelte';
	import Icon from '$lib/components/icon.svelte';
	import { onMount } from 'svelte';

	interface Props {
		userId: number;
		nama: string;
		tanggal: string;
		tanggalJam?: string | null;
		initialStatus?: string | null;
		initialTandaTangan?: string | null;
		initialKeterangan?: string | null;
	}

	let {
		userId,
		nama,
		tanggal,
		tanggalJam = null,
		initialStatus = null,
		initialTandaTangan = null,
		initialKeterangan = null
	}: Props = $props();

	type Status = 'hadir' | 'izin' | 'sakit' | 'dinas_luar' | 'cuti';

	const STATUS_OPTIONS: Array<{ value: Status; label: string }> = [
		{ value: 'hadir', label: 'Hadir' },
		{ value: 'izin', label: 'Izin' },
		{ value: 'sakit', label: 'Sakit' },
		{ value: 'dinas_luar', label: 'Dinas Luar' },
		{ value: 'cuti', label: 'Cuti' }
	];

	const VALID_STATUS: Status[] = ['hadir', 'izin', 'sakit', 'dinas_luar', 'cuti'];

	/** Parse "Cuti 15-08-2026 s/d 20-08-2026" (stored keterangan) back into ISO dates. */
	function parseCutiRange(keterangan: string | null): { mulai: string; selesai: string } | null {
		if (!keterangan) return null;
		const m = /Cuti\s+(\d{2})-(\d{2})-(\d{4})\s+s\/d\s+(\d{2})-(\d{2})-(\d{4})/.exec(keterangan);
		if (!m) return null;
		return {
			mulai: `${m[3]}-${m[2]}-${m[1]}`,
			selesai: `${m[6]}-${m[5]}-${m[4]}`
		};
	}

	/** Drop the auto-generated "Cuti dd-mm-yyyy s/d dd-mm-yyyy — " prefix from stored text. */
	function stripCutiLabel(text: string): string {
		const m = /^Cuti\s+\d{2}-\d{2}-\d{4}\s+s\/d\s+\d{2}-\d{2}-\d{4}(\s+—\s+)?/.exec(text);
		return m ? text.slice(m[0].length) : text;
	}

	// svelte-ignore state_referenced_locally
	const initialCuti = parseCutiRange(initialKeterangan);

	// svelte-ignore state_referenced_locally
	let selectedStatus = $state<Status>(
		initialStatus && (VALID_STATUS as string[]).includes(initialStatus)
			? (initialStatus as Status)
			: 'hadir'
	);
	// svelte-ignore state_referenced_locally
	let keterangan = $state(stripCutiLabel(initialKeterangan ?? ''));
	// svelte-ignore state_referenced_locally
	let cutiMulai = $state(initialCuti?.mulai ?? tanggal);
	// svelte-ignore state_referenced_locally
	let cutiSelesai = $state(initialCuti?.selesai ?? tanggal);
	let redraw = $state(false);
	let submitting = $state(false);

	let canvasEl: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D | null = null;
	let drawing = $state(false);
	let hasSignature = $state(false);
	let lastX = 0;
	let lastY = 0;

	const CANVAS_W = 400;
	const CANVAS_H = 400;

	function initCanvas(el: HTMLCanvasElement) {
		canvasEl = el;
		const context = el.getContext('2d');
		if (!context) return;
		ctx = context;
		return {
			destroy() {
				ctx = null;
			}
		};
	}

	onMount(() => {
		updateModal({
			onPositive: { label: 'Simpan', class: 'btn-primary', action: () => void submit() },
			onNegative: undefined,
			onNeutral: { label: 'Batal', action: () => hideModal() },
			spreadActions: true
		});
	});

	function getPos(e: MouseEvent | TouchEvent) {
		const rect = canvasEl.getBoundingClientRect();
		const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
		const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
		return {
			x: ((clientX - rect.left) / rect.width) * CANVAS_W,
			y: ((clientY - rect.top) / rect.height) * CANVAS_H
		};
	}

	function startDraw(e: MouseEvent | TouchEvent) {
		if (!ctx) return;
		drawing = true;
		const pos = getPos(e);
		lastX = pos.x;
		lastY = pos.y;
		ctx.beginPath();
		ctx.moveTo(lastX, lastY);
	}

	function draw(e: MouseEvent | TouchEvent) {
		if (!drawing || !ctx) return;
		e.preventDefault();
		const pos = getPos(e);
		ctx.strokeStyle = '#000000';
		ctx.lineWidth = 18;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		ctx.lineTo(pos.x, pos.y);
		ctx.stroke();
		hasSignature = true;
	}

	function endDraw() {
		drawing = false;
	}

	function clearSignature() {
		if (!ctx) return;
		ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
		hasSignature = false;
	}

	function getSignatureData(): string | null {
		if (!canvasEl || !hasSignature) return null;
		return canvasEl.toDataURL('image/png');
	}

	const showCanvas = $derived(selectedStatus === 'hadir' && (redraw || !initialTandaTangan));

	const tanggalLabel = $derived.by(() => {
		const d = new Date(`${tanggal}T00:00:00`);
		return d.toLocaleDateString('id-ID', {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
	});

	async function submit() {
		if (submitting) return;
		if (selectedStatus === 'hadir' && !hasSignature && !initialTandaTangan) {
			toast('Silakan buat paraf terlebih dahulu.', 'warning');
			return;
		}
		if (selectedStatus === 'cuti') {
			if (!cutiMulai || !cutiSelesai) {
				toast('Tanggal mulai dan selesai cuti wajib diisi.', 'warning');
				return;
			}
			if (cutiSelesai < cutiMulai) {
				toast('Tanggal selesai cuti tidak boleh sebelum tanggal mulai.', 'warning');
				return;
			}
		}
		submitting = true;
		try {
			const res = await fetch('/api/presensi-guru/admin', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					userId,
					tanggal,
					status: selectedStatus,
					tandaTangan: selectedStatus === 'hadir' && showCanvas ? getSignatureData() : null,
					keterangan: keterangan.trim() || null,
					tanggalJam,
					cutiMulai: selectedStatus === 'cuti' ? cutiMulai : null,
					cutiSelesai: selectedStatus === 'cuti' ? cutiSelesai : null,
					cutiMulaiAsli: selectedStatus === 'cuti' ? (initialCuti?.mulai ?? null) : null,
					cutiSelesaiAsli: selectedStatus === 'cuti' ? (initialCuti?.selesai ?? null) : null
				})
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				throw new Error((data as { message?: string }).message ?? `Error ${res.status}`);
			}
			hideModal();
			await invalidate('app:presensi-guru');
			toast('Presensi berhasil disimpan.', 'success');
		} catch (e) {
			toast(e instanceof Error ? e.message : 'Gagal menyimpan presensi', 'error');
		} finally {
			submitting = false;
		}
	}
</script>

<div class="not-prose flex flex-col gap-4">
	{#if tanggalJam}
		<div
			class="flex items-center gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/90 px-3.5 py-2.5 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
		>
			<Icon name="alert" class="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
			<span>Mode simulasi: waktu dicatat mengikuti <strong>{tanggalJam}</strong></span>
		</div>
	{/if}

	<div class="space-y-1 text-xs text-slate-700 dark:text-zinc-300">
		<p><strong class="text-slate-900 dark:text-zinc-100">Nama:</strong> {nama}</p>
		<p><strong class="text-slate-900 dark:text-zinc-100">Tanggal:</strong> {tanggalLabel}</p>
	</div>

	<label class="flex flex-col gap-1.5">
		<span class="text-xs font-medium text-slate-700 dark:text-zinc-300">Status Kehadiran</span>
		<div class="relative flex items-center">
			<select
				class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
				bind:value={selectedStatus}
				disabled={submitting}
			>
				{#each STATUS_OPTIONS as opt (opt.value)}
					<option value={opt.value}>{opt.label}</option>
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

	{#if selectedStatus === 'hadir'}
		{#if !showCanvas}
			<div class="space-y-2">
				<span class="block text-xs font-medium text-slate-700 dark:text-zinc-300"
					>Paraf tersimpan</span
				>
				<img
					src={initialTandaTangan ?? ''}
					alt="Paraf"
					class="max-h-24 rounded-xl border border-slate-200/80 bg-white p-1.5 dark:border-zinc-700"
				/>
				<button
					type="button"
					class="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
					onclick={() => (redraw = true)}
					disabled={submitting}
				>
					<Icon name="pen" class="h-3.5 w-3.5" />
					Ganti Paraf
				</button>
			</div>
		{:else}
			<div class="space-y-2">
				<span class="block text-xs font-medium text-slate-700 dark:text-zinc-300">Paraf</span>
				<div
					class="overflow-hidden rounded-xl border border-slate-200/80 bg-slate-100 p-2 dark:border-zinc-800 dark:bg-zinc-800"
				>
					<canvas
						use:initCanvas
						width={CANVAS_W}
						height={CANVAS_H}
						class="mx-auto w-full max-w-52 cursor-crosshair touch-none rounded-lg bg-white"
						style="aspect-ratio: {CANVAS_W}/{CANVAS_H}; min-height: 180px;"
						onmousedown={startDraw}
						onmousemove={draw}
						onmouseup={endDraw}
						onmouseleave={endDraw}
						ontouchstart={startDraw}
						ontouchmove={draw}
						ontouchend={endDraw}
					></canvas>
				</div>
				<div class="flex items-center justify-between gap-2">
					<p class="text-[11px] text-slate-400 dark:text-zinc-500">
						Hanya paraf, bukan tanda tangan.
					</p>
					<div class="flex items-center gap-1.5">
						{#if initialTandaTangan && redraw}
							<button
								type="button"
								class="inline-flex h-8 items-center justify-center rounded-lg border border-[#7e8b9b] bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
								onclick={() => {
									clearSignature();
									redraw = false;
								}}
								disabled={submitting}
							>
								Batal
							</button>
						{/if}
						{#if hasSignature}
							<button
								type="button"
								class="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-red-200/80 bg-red-50 px-3 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950"
								onclick={clearSignature}
								disabled={submitting}
							>
								<Icon name="del" class="h-3.5 w-3.5" />
								Hapus
							</button>
						{/if}
					</div>
				</div>
			</div>
		{/if}
	{/if}

	{#if selectedStatus === 'cuti'}
		<div
			class="space-y-2.5 rounded-xl border border-slate-200/80 bg-slate-50/65 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/45"
		>
			<span class="block text-xs font-semibold text-slate-800 dark:text-zinc-200">Rentang Cuti</span
			>
			<div class="grid grid-cols-2 gap-2.5">
				<label class="flex flex-col gap-1">
					<span class="text-[11px] font-medium text-slate-600 dark:text-zinc-300"
						>Tanggal Mulai</span
					>
					<input
						type="date"
						class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
						bind:value={cutiMulai}
						disabled={submitting}
					/>
				</label>
				<label class="flex flex-col gap-1">
					<span class="text-[11px] font-medium text-slate-600 dark:text-zinc-300"
						>Tanggal Selesai</span
					>
					<input
						type="date"
						class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
						bind:value={cutiSelesai}
						disabled={submitting}
					/>
				</label>
			</div>
			<p class="text-[11px] text-slate-400 dark:text-zinc-500">
				Semua tanggal dalam rentang ini akan tercatat sebagai Cuti (Ct).
			</p>
		</div>
	{/if}

	<label class="flex flex-col gap-1.5">
		<span class="text-xs font-medium text-slate-700 dark:text-zinc-300"
			>Keterangan <span class="font-normal text-slate-400 dark:text-zinc-500">(opsional)</span
			></span
		>
		<textarea
			class="min-h-18 w-full rounded-xl border border-[#7e8b9b] bg-white p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
			rows="2"
			bind:value={keterangan}
			placeholder="Catatan tambahan..."
			disabled={submitting}></textarea>
	</label>
</div>
