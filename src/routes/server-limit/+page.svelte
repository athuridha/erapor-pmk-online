<script lang="ts">
	let { data } = $props();

	let showContactModal = $state(false);
	let isRefreshing = $state(false);

	function handleRefresh() {
		isRefreshing = true;
		setTimeout(() => {
			window.location.reload();
		}, 500);
	}
</script>

<svelte:head>
	<title>500 - OOPS! Server Error | Server Telah Melebihi Batas Limit</title>
</svelte:head>

<!-- Fullscreen Outer Container with Decorative Dark Navy Background -->
<div class="min-h-screen bg-[#282433] text-slate-800 flex items-center justify-center p-4 sm:p-8 relative overflow-hidden font-sans antialiased selection:bg-orange-200">
	<!-- Abstract Colorful Background Shapes (Matching Mockup) -->
	<!-- Top-Left Blue Circle -->
	<div class="pointer-events-none absolute -top-24 -left-20 w-80 h-80 rounded-full bg-[#2d6dcf] blur-2xl opacity-90"></div>
	<div class="pointer-events-none absolute -top-16 -left-12 w-64 h-64 rounded-full bg-[#2563eb] opacity-80"></div>

	<!-- Top-Right / Right Orange Area -->
	<div class="pointer-events-none absolute -top-32 -right-24 w-[520px] h-[520px] rounded-full bg-[#f7691f] blur-3xl opacity-80"></div>
	<div class="pointer-events-none absolute top-0 -right-28 w-[400px] h-[400px] rounded-full bg-[#ea580c] opacity-85"></div>

	<!-- Bottom-Left Yellow Ring -->
	<div class="pointer-events-none absolute -bottom-24 -left-12 w-64 h-64 rounded-full border-[22px] border-[#e5aa3a] opacity-85"></div>
	<div class="pointer-events-none absolute -bottom-16 -left-8 w-48 h-48 rounded-full border-[14px] border-[#fbbf24] opacity-50 blur-sm"></div>

	<!-- Main White Card -->
	<div class="max-w-4xl w-full bg-white rounded-[32px] sm:rounded-[36px] shadow-[0_30px_90px_rgba(0,0,0,0.45)] p-8 sm:p-14 lg:p-16 relative z-10 my-auto">
		<div class="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12 items-center">
			<!-- Left Column: 500, Message, and Button -->
			<div class="md:col-span-7 flex flex-col items-center md:items-start text-center md:text-left">
				<!-- Big Orange 500 -->
				<h1 class="text-7xl sm:text-8xl lg:text-9xl font-black text-[#ed6e29] tracking-tight leading-none mb-3">
					500
				</h1>

				<!-- Sub-headline -->
				<h2 class="text-xl sm:text-2xl font-bold text-slate-700 tracking-tight mb-3">
					OOPS! Server Error
				</h2>

				<!-- Description text as requested -->
				<p class="text-xs sm:text-sm text-slate-500 leading-relaxed max-w-md mb-8">
					Oooh!, Maaf server telah melebihi batas limit penggunaan sumber daya. Layanan ditangguhkan sementara dan harus melakukan upgrade paket server untuk mengaktifkan kembali akses.
				</p>

				<!-- Buttons -->
				<div class="flex flex-wrap items-center justify-center md:justify-start gap-3">
					<!-- Orange Upgrade Server Pill Button -->
					<button
						type="button"
						onclick={() => showContactModal = true}
						class="px-6 py-3 rounded-full bg-[#ed6e29] hover:bg-[#d95d1d] text-white text-xs sm:text-sm font-semibold shadow-lg shadow-orange-500/25 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
					>
						<!-- Upgrade / Arrow Up Icon -->
						<svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 10l7-7m0 0l7 7m-7-7v18" />
						</svg>
						<span>Upgrade Server</span>
					</button>

					<!-- Refresh Button -->
					<button
						type="button"
						onclick={handleRefresh}
						disabled={isRefreshing}
						class="px-5 py-3 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs sm:text-sm font-medium transition-all flex items-center gap-2 cursor-pointer active:scale-95"
					>
						<svg class="w-4 h-4 {isRefreshing ? 'animate-spin' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
						</svg>
						<span>{isRefreshing ? 'Memuat...' : 'Coba Lagi'}</span>
					</button>
				</div>
			</div>

			<!-- Right Column: Isometric Illustration from image -->
			<div class="md:col-span-5 flex justify-center items-center py-4">
				<img
					src="/server-error-illustration.png"
					alt="Server Telah Melebihi Batas Limit"
					class="w-full max-w-[280px] sm:max-w-[340px] h-auto object-contain mx-auto select-none pointer-events-none drop-shadow-sm"
					loading="eager"
				/>
			</div>
		</div>
	</div>
</div>

<!-- Modal Dialog: Upgrade Server -->
{#if showContactModal}
	<div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
		<div class="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-100 relative animate-in fade-in zoom-in-95 duration-150">
			<div class="flex items-start justify-between mb-4">
				<div>
					<h3 class="text-lg font-bold text-slate-900">Upgrade Paket Server</h3>
					<p class="text-xs text-slate-500">Tingkatkan kuota & kapasitas sumber daya</p>
				</div>
				<button
					type="button"
					aria-label="Tutup"
					onclick={() => showContactModal = false}
					class="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
				>
					<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<div class="p-4 rounded-2xl bg-orange-50 border border-orange-100 mb-5 text-xs text-orange-950 space-y-1.5">
				<div class="flex items-center gap-2 font-bold text-orange-800">
					<svg class="w-4 h-4 text-orange-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
						<path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
					</svg>
					Batas Kuota Server Telah Tercapai
				</div>
				<p class="text-slate-600 leading-relaxed">
					Server ini telah mencapai batas pemakaian sumber daya paket saat ini. Untuk mengaktifkan kembali layanan dan memperbesar kuota CPU, RAM, serta bandwidth, diperlukan upgrade paket server.
				</p>
			</div>

			<div class="space-y-2.5 mb-6 text-xs text-slate-600">
				<div class="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
					<span class="font-medium text-slate-500">Domain</span>
					<span class="font-mono font-bold text-slate-800">{data.host || 'erapor-pmk.titipit.id'}</span>
				</div>
				<div class="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
					<span class="font-medium text-slate-500">Status Server</span>
					<span class="font-bold text-orange-600">Upgrade Required (Over Quota)</span>
				</div>
			</div>

			<div class="flex items-center justify-end gap-3">
				<button
					type="button"
					onclick={() => showContactModal = false}
					class="w-full py-2.5 rounded-xl bg-[#ed6e29] hover:bg-[#d95d1d] text-white font-semibold text-xs transition-colors shadow-md shadow-orange-500/20 cursor-pointer"
				>
					Tutup
				</button>
			</div>
		</div>
	</div>
{/if}
