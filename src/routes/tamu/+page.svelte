<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	import { toast } from '$lib/components/toast.svelte';
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let formEl = $state<HTMLFormElement>();
	let canvasEl = $state<HTMLCanvasElement>();
	let ctx: CanvasRenderingContext2D | null = null;
	let drawing = $state(false);
	let hasSignature = $state(false);
	let submitting = $state(false);
	let submitted = $state(false);

	let lastX = 0;
	let lastY = 0;

	const gated = $derived(Boolean(data.passkeySet) && !data.unlocked);

	$effect(() => {
		if (submitted || !canvasEl) return;
		ctx = canvasEl.getContext('2d');
		if (!ctx) return;
		resizeCanvas();
		const onResize = () => resizeCanvas();
		window.addEventListener('resize', onResize);
		return () => {
			window.removeEventListener('resize', onResize);
		};
	});

	function resizeCanvas() {
		if (!canvasEl || !ctx) return;
		const tempCanvas = document.createElement('canvas');
		tempCanvas.width = canvasEl.width;
		tempCanvas.height = canvasEl.height;
		const tempCtx = tempCanvas.getContext('2d');
		if (tempCtx) tempCtx.drawImage(canvasEl, 0, 0);
		const rect = canvasEl.getBoundingClientRect();
		canvasEl.width = Math.max(1, Math.round(rect.width)) * 2;
		canvasEl.height = Math.max(1, Math.round(rect.height)) * 2;
		// Copy the previous content 1:1 (old and new bitmaps are both 2x CSS px).
		ctx.save();
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.drawImage(tempCanvas, 0, 0);
		ctx.restore();
		// Logical space = CSS pixels; strokes render at 2x physical resolution.
		ctx.setTransform(2, 0, 0, 2, 0, 0);
	}

	function getPos(e: MouseEvent | TouchEvent) {
		const rect = canvasEl!.getBoundingClientRect();
		if ('touches' in e) {
			const touch = e.touches[0];
			return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
		}
		return { x: e.clientX - rect.left, y: e.clientY - rect.top };
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
		ctx.lineWidth = 2;
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
		if (!ctx || !canvasEl) return;
		ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
		hasSignature = false;
	}

	function getSignatureData(): string | null {
		if (!canvasEl || !hasSignature) return null;
		return canvasEl.toDataURL('image/png');
	}

	async function handleSubmit(e?: Event) {
		if (e) e.preventDefault();
		if (submitting) return;

		const formData = new FormData(formEl);
		const nama = String(formData.get('nama') || '').trim();
		const asalInstansi = String(formData.get('asalInstansi') || '').trim();
		const nip = String(formData.get('nip') || '').trim();
		const keperluan = String(formData.get('keperluan') || '').trim();
		const pesanKesan = String(formData.get('pesanKesan') || '').trim();

		if (!nama || !asalInstansi || !keperluan) {
			toast('Harap isi nama, asal/instansi, dan keperluan.', 'warning');
			return;
		}

		submitting = true;
		try {
			const res = await fetch('/api/buku-tamu', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					nama,
					asalInstansi,
					nip: nip || null,
					keperluan,
					pesanKesan: pesanKesan || null,
					tandaTangan: getSignatureData()
				})
			});

			const data = await res.json().catch(() => ({}));

			if (!res.ok) {
				toast(data?.message || 'Gagal menyimpan data', 'error');
				return;
			}

			submitted = true;
			formEl!.reset();
			clearSignature();
		} catch {
			toast('Terjadi kesalahan jaringan', 'error');
		} finally {
			submitting = false;
		}
	}

	function submitAnother() {
		submitted = false;
	}
</script>

<svelte:head>
	<title>Buku Tamu</title>
</svelte:head>

<div
	class="w-full rounded-2xl border border-slate-200/75 bg-white p-5 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:max-w-lg sm:p-6 dark:border-zinc-800 dark:bg-zinc-900"
>
	<header class="mb-5 border-b border-slate-100 pb-4 text-center dark:border-zinc-800">
		<h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">Buku Tamu</h1>
		<p class="mt-1 text-xs text-slate-500 dark:text-zinc-400">
			Silakan mengisi data diri Anda untuk keperluan kunjungan.
		</p>
	</header>

	{#if gated}
		<FormEnhance action="?/unlock">
			{#snippet children({ submitting, invalid })}
				<div class="space-y-4">
					<div
						class="flex items-start gap-2.5 rounded-xl border border-blue-200/80 bg-blue-50/70 px-4 py-3 text-xs text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200"
					>
						<Icon name="info" class="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
						<span class="leading-relaxed">
							Halaman ini dilindungi passkey. Hubungi pihak sekolah untuk mendapatkan passkey.
						</span>
					</div>
					<div>
						<label
							class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
							for="passkey">Passkey</label
						>
						<input
							type="password"
							id="passkey"
							name="passkey"
							required
							minlength={4}
							maxlength={64}
							placeholder="Masukkan passkey"
							class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
						/>
					</div>
					<button
						class="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
						type="submit"
						disabled={submitting || invalid}
					>
						{#if submitting}
							<span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
						{/if}
						Masuk
					</button>
				</div>
			{/snippet}
		</FormEnhance>
	{:else if submitted}
		<div class="space-y-4 text-center">
			<div
				class="flex items-center justify-center gap-2 rounded-xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-3 text-xs font-medium text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200"
			>
				<Icon name="success" class="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
				<span>Terima kasih! Data kunjungan Anda telah tersimpan.</span>
			</div>
			<button
				type="button"
				class="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
				onclick={submitAnother}
			>
				<Icon name="plus" class="h-3.5 w-3.5" />
				Tulis Lagi
			</button>
		</div>
	{:else}
		<form bind:this={formEl} class="space-y-3.5">
			<div>
				<label
					class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
					for="nama"
				>
					Nama <span class="text-red-500">*</span>
				</label>
				<input
					type="text"
					id="nama"
					name="nama"
					required
					placeholder="Nama lengkap"
					class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
				/>
			</div>

			<div>
				<label
					class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
					for="asalInstansi"
				>
					Asal / Instansi <span class="text-red-500">*</span>
				</label>
				<input
					type="text"
					id="asalInstansi"
					name="asalInstansi"
					required
					placeholder="Masukkan alamat atau asal instansi"
					class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
				/>
			</div>

			<div>
				<label
					class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
					for="nip"
				>
					NIP (opsional)
				</label>
				<input
					type="text"
					id="nip"
					name="nip"
					placeholder="Masukkan NIP jika ada"
					class="h-9 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
				/>
			</div>

			<div>
				<label
					class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
					for="keperluan"
				>
					Keperluan <span class="text-red-500">*</span>
				</label>
				<textarea
					id="keperluan"
					name="keperluan"
					required
					rows="2"
					placeholder="Isi keperluan kunjungan"
					class="w-full rounded-xl border border-[#7e8b9b] bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
				></textarea>
			</div>

			<div>
				<label
					class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
					for="pesanKesan"
				>
					Pesan & Kesan (opsional)
				</label>
				<textarea
					id="pesanKesan"
					name="pesanKesan"
					rows="2"
					placeholder="Isi pesan atau kesan Anda"
					class="w-full rounded-xl border border-[#7e8b9b] bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
				></textarea>
			</div>

			<div>
				<div class="mb-1.5 flex items-center justify-between">
					<span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">Tanda Tangan</span>
					{#if hasSignature}
						<button
							type="button"
							class="inline-flex h-6 items-center rounded-lg border border-red-200/80 bg-red-50 px-2 text-[11px] font-semibold text-red-700 transition-colors hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-300"
							onclick={clearSignature}
						>
							Hapus
						</button>
					{/if}
				</div>
				<div
					class="overflow-hidden rounded-xl border border-[#7e8b9b] bg-white dark:border-zinc-600"
				>
					<canvas
						bind:this={canvasEl}
						class="w-full cursor-crosshair touch-none bg-white"
						style="height: 160px;"
						onmousedown={startDraw}
						onmousemove={draw}
						onmouseup={endDraw}
						onmouseleave={endDraw}
						ontouchstart={startDraw}
						ontouchmove={draw}
						ontouchend={endDraw}
					></canvas>
				</div>
				<p class="mt-1 text-[11px] text-slate-500 dark:text-zinc-400">
					Tanda tangan di atas (opsional)
				</p>
			</div>

			<button
				class="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
				type="button"
				disabled={submitting}
				onclick={handleSubmit}
			>
				{#if submitting}
					<span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
				{/if}
				Kirim
			</button>
		</form>
	{/if}
</div>
