<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { hideModal, updateModal } from '$lib/components/global-modal.svelte';
	import { toast } from '$lib/components/toast.svelte';
	import Icon from '$lib/components/icon.svelte';
	import { onMount } from 'svelte';

	interface Props {
		jamMasuk?: string | null;
		jamPulang?: string | null;
		tanggalJam?: string | null;
	}

	let { jamMasuk = null, jamPulang = null, tanggalJam = null }: Props = $props();

	type Status = 'hadir' | 'izin' | 'sakit' | 'dinas_luar';

	const STATUS_OPTIONS: Array<{ value: Status; label: string }> = [
		{ value: 'hadir', label: 'Hadir' },
		{ value: 'izin', label: 'Izin' },
		{ value: 'sakit', label: 'Sakit' },
		{ value: 'dinas_luar', label: 'Dinas Luar' }
	];

	let step = $state<'pilih' | 'paraf'>('pilih');
	let selectedStatus = $state<Status>('hadir');
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
			onPositive: undefined,
			onNegative: undefined,
			onNeutral: undefined
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

	function pilihHadir() {
		selectedStatus = 'hadir';
		step = 'paraf';
		updateModal({
			onPositive: { label: 'Simpan', class: 'btn-primary', action: () => submit() },
			onNegative: { label: 'Kembali', action: () => goBack() },
			onNeutral: undefined
		});
	}

	function goBack() {
		step = 'pilih';
		updateModal({
			onPositive: undefined,
			onNegative: undefined,
			onNeutral: undefined
		});
	}

	async function submit() {
		if (submitting) return;
		if (selectedStatus === 'hadir' && !hasSignature) {
			toast('Silakan buat paraf terlebih dahulu.', 'warning');
			return;
		}
		submitting = true;
		try {
			const res = await fetch('/api/presensi-guru', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					status: selectedStatus,
					tandaTangan: selectedStatus === 'hadir' ? getSignatureData() : null,
					tanggalJam: tanggalJam
				})
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				throw new Error((data as { message?: string }).message ?? `Error ${res.status}`);
			}
			hideModal();
			await invalidate('app:presensi-guru');
			toast('Presensi berhasil disimpan. Terima kasih!', 'success');
		} catch (e) {
			toast(e instanceof Error ? e.message : 'Gagal menyimpan presensi', 'error');
		} finally {
			submitting = false;
		}
	}

	function handleSimpan() {
		if (selectedStatus === 'hadir') {
			pilihHadir();
			return;
		}
		void submit();
	}

	const windowLabel = $derived.by(() => {
		if (!jamMasuk && !jamPulang) return null;
		return `${jamMasuk ?? '?'} - ${jamPulang ?? '?'}`;
	});

	const simulasiLabel = $derived.by(() => {
		if (!tanggalJam) return null;
		const d = new Date(tanggalJam);
		if (Number.isNaN(d.getTime())) return tanggalJam;
		return `${d.toLocaleDateString('id-ID', {
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		})} ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
	});
</script>

<div class="not-prose flex flex-col gap-4">
	{#if simulasiLabel}
		<div
			class="flex items-center gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/90 px-3.5 py-2.5 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
		>
			<Icon name="alert" class="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
			<span>Mode simulasi: waktu dicatat sebagai: <strong>{simulasiLabel}</strong></span>
		</div>
	{/if}
	{#if step === 'pilih'}
		<div class="space-y-4">
			<div
				class="flex items-start gap-2.5 rounded-xl border border-blue-200/80 bg-blue-50/80 px-3.5 py-2.5 text-xs leading-relaxed text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200"
			>
				<Icon name="info" class="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
				<span>
					Bapak/Ibu belum melakukan presensi hari ini. Silakan lakukan presensi sebelum jam pulang.
					{#if windowLabel}
						<br />
						<span class="font-semibold">Jam presensi: {windowLabel}</span>
					{/if}
				</span>
			</div>
			<div class="space-y-4">
				<label class="flex flex-col gap-1.5">
					<span class="text-xs font-medium text-slate-700 dark:text-zinc-300">Status Kehadiran</span
					>
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
				<button
					type="button"
					class="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
					disabled={submitting}
					onclick={handleSimpan}
				>
					<Icon name={selectedStatus === 'hadir' ? 'pen' : 'save'} class="h-3.5 w-3.5" />
					{selectedStatus === 'hadir' ? 'Paraf' : 'Simpan'}
				</button>
			</div>
		</div>
	{:else}
		<div class="space-y-3">
			<p class="text-xs text-slate-600 dark:text-zinc-400">
				Buat paraf Bapak/Ibu pada kotak di bawah ini.
			</p>
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
	{/if}
</div>
