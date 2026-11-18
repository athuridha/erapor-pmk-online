<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	import { toast } from '$lib/components/toast.svelte';

	let {
		pegawaiId,
		existingSrc = null,
		canEdit = true,
		simpanDi = null
	}: {
		pegawaiId: number;
		existingSrc?: string | null;
		canEdit?: boolean;
		/** Dipanggil setelah tanda tangan tersimpan (untuk refresh daftar). */
		simpanDi?: (() => void | Promise<void>) | null;
	} = $props();

	const CANVAS_W = 480;
	const CANVAS_H = 200;

	let canvasEl: HTMLCanvasElement | null = $state(null);
	let ctx: CanvasRenderingContext2D | null = null;
	let drawing = $state(false);
	let hasSignature = $state(false);
	let pendingSrc = $state<string | null>(null);
	let submitting = $state(false);
	let fileInput: HTMLInputElement | null = $state(null);

	$effect(() => {
		if (!canvasEl) return;
		ctx = canvasEl.getContext('2d');
		if (!ctx) return;
		ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
		ctx.strokeStyle = '#000000';
		ctx.lineWidth = 6;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
	});

	function getPos(e: MouseEvent | TouchEvent) {
		if (!canvasEl) return { x: 0, y: 0 };
		const rect = canvasEl.getBoundingClientRect();
		const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
		const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
		return {
			x: ((clientX - rect.left) / rect.width) * CANVAS_W,
			y: ((clientY - rect.top) / rect.height) * CANVAS_H
		};
	}

	function startDraw(e: MouseEvent | TouchEvent) {
		if (!ctx || !canEdit) return;
		drawing = true;
		const pos = getPos(e);
		ctx.beginPath();
		ctx.moveTo(pos.x, pos.y);
	}

	function draw(e: MouseEvent | TouchEvent) {
		if (!drawing || !ctx) return;
		e.preventDefault();
		const pos = getPos(e);
		ctx.lineTo(pos.x, pos.y);
		ctx.stroke();
		hasSignature = true;
		pendingSrc = null;
	}

	function endDraw() {
		drawing = false;
	}

	function bersihkan() {
		if (!ctx) return;
		ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
		hasSignature = false;
		pendingSrc = null;
	}

	/** Gambar yang diunggah dikonversi ke PNG transparan supaya server bisa storing. */
	function pilihBerkas(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		if (!file.type.startsWith('image/')) {
			toast({ message: 'Pilih berkas gambar (PNG/JPG).', type: 'warning' });
			return;
		}

		const reader = new FileReader();
		reader.onload = () => {
			const image = new Image();
			image.onload = () => {
				const canvas = document.createElement('canvas');
				canvas.width = CANVAS_W;
				canvas.height = CANVAS_H;
				const context = canvas.getContext('2d');
				if (!context) return;
				context.fillStyle = '#ffffff';
				context.fillRect(0, 0, CANVAS_W, CANVAS_H);
				const scale = Math.min(CANVAS_W / image.width, CANVAS_H / image.height);
				const width = image.width * scale;
				const height = image.height * scale;
				context.drawImage(image, (CANVAS_W - width) / 2, (CANVAS_H - height) / 2, width, height);
				pendingSrc = canvas.toDataURL('image/png');
				hasSignature = true;
				toast({ message: 'Gambar siap disimpan.', type: 'info' });
			};
			image.onerror = () => toast({ message: 'Gambar tidak bisa dibaca.', type: 'error' });
			image.src = String(reader.result);
		};
		reader.onerror = () => toast({ message: 'Gagal membaca berkas gambar.', type: 'error' });
		reader.readAsDataURL(file);
	}

	async function simpan() {
		if (submitting) return;
		let dataUrl: string | null = pendingSrc;
		if (!dataUrl && hasSignature && canvasEl) {
			dataUrl = canvasEl.toDataURL('image/png');
		}
		if (!dataUrl) {
			toast({ message: 'Buat atau unggah tanda tangan terlebih dahulu.', type: 'warning' });
			return;
		}

		submitting = true;
		try {
			const response = await fetch('/api/tanda-tangan', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ pegawaiId, tandaTangan: dataUrl }),
				credentials: 'same-origin'
			});
			const payload = await response.json().catch(() => null);
			if (!response.ok) {
				throw new Error(payload?.message ?? `Gagal menyimpan tanda tangan (${response.status}).`);
			}
			toast({ message: 'Tanda tangan tersimpan.', type: 'success' });
			await simpanDi?.();
		} catch (error) {
			toast({
				message: error instanceof Error ? error.message : 'Gagal menyimpan tanda tangan.',
				type: 'error'
			});
		} finally {
			submitting = false;
		}
	}

	async function hapus() {
		if (submitting) return;
		submitting = true;
		try {
			const response = await fetch('/api/tanda-tangan', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ pegawaiId, tandaTangan: null }),
				credentials: 'same-origin'
			});
			if (!response.ok) {
				const payload = await response.json().catch(() => null);
				throw new Error(payload?.message ?? 'Gagal menghapus tanda tangan.');
			}
			bersihkan();
			toast({ message: 'Tanda tangan dihapus.', type: 'success' });
			await simpanDi?.();
		} catch (error) {
			toast({
				message: error instanceof Error ? error.message : 'Gagal menghapus tanda tangan.',
				type: 'error'
			});
		} finally {
			submitting = false;
		}
	}
</script>

<div class="space-y-3">
	<div
		class="relative overflow-hidden rounded-xl border border-[#7e8b9b] bg-white dark:border-zinc-600"
	>
		<canvas
			bind:this={canvasEl}
			width={CANVAS_W}
			height={CANVAS_H}
			class="h-40 w-full touch-none"
			class:cursor-not-allowed={!canEdit}
			aria-label="Kanvas tanda tangan"
			onmousedown={startDraw}
			onmousemove={draw}
			onmouseup={endDraw}
			onmouseleave={endDraw}
			ontouchstart={startDraw}
			ontouchmove={draw}
			ontouchend={endDraw}
		></canvas>
		{#if pendingSrc}
			<img
				src={pendingSrc}
				alt="Pratinjau tanda tangan"
				class="pointer-events-none absolute inset-0 h-full w-full object-contain"
			/>
		{/if}
		{#if !canEdit}
			<div
				class="absolute inset-0 flex items-center justify-center bg-slate-900/50 text-xs font-medium text-white backdrop-blur-[1px]"
			>
				Hanya admin atau wali kelas yang bisa mengunggah.
			</div>
		{/if}
	</div>

	{#if existingSrc && !pendingSrc}
		<div class="flex items-center gap-2 text-xs">
			<span class="text-slate-500 dark:text-zinc-400">Tersimpan:</span>
			<img
				src={existingSrc}
				alt="Tanda tangan tersimpan"
				class="h-10 rounded-lg border border-slate-200 bg-white dark:border-zinc-700"
			/>
		</div>
	{/if}

	<div class="flex flex-wrap gap-2">
		<button
			class="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
			type="button"
			onclick={simpan}
			disabled={submitting || !canEdit}
		>
			{#if submitting}
				<span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
				Menyimpan...
			{:else}
				<Icon name="save" class="h-3.5 w-3.5" />
				Simpan Tanda Tangan
			{/if}
		</button>
		<button
			class="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
			type="button"
			onclick={bersihkan}
			disabled={submitting || !canEdit}
		>
			<Icon name="repeat" class="h-3.5 w-3.5" />
			Bersihkan
		</button>
		<button
			class="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
			type="button"
			onclick={() => fileInput?.click()}
			disabled={submitting || !canEdit}
		>
			<Icon name="image" class="h-3.5 w-3.5" />
			Unggah Gambar
		</button>
		<button
			class="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-red-200/80 bg-red-50 px-3 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950"
			type="button"
			onclick={hapus}
			disabled={submitting || !canEdit}
		>
			<Icon name="del" class="h-3.5 w-3.5" />
			Hapus
		</button>
		<input
			bind:this={fileInput}
			type="file"
			accept="image/png,image/jpeg,image/webp"
			class="hidden"
			onchange={pilihBerkas}
		/>
	</div>
</div>
