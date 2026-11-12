<script lang="ts">
	let { data } = $props();

	let showContactModal = $state(false);
	let isRefreshing = $state(false);
	let copied = $state(false);

	const incidentId = 'INC-' + Math.random().toString(36).substring(2, 10).toUpperCase();

	function handleRefresh() {
		isRefreshing = true;
		setTimeout(() => {
			window.location.reload();
		}, 600);
	}

	function copyIncidentId() {
		navigator.clipboard?.writeText?.(incidentId);
		copied = true;
		setTimeout(() => {
			copied = false;
		}, 2000);
	}
</script>

<svelte:head>
	<title>508 Resource Limit Reached | Server Over Quota</title>
</svelte:head>

<div class="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-rose-500 selection:text-white font-sans antialiased relative overflow-hidden">
	<!-- Background ambient glow -->
	<div class="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-b from-rose-600/15 via-amber-500/10 to-transparent blur-3xl opacity-70"></div>
	<div class="pointer-events-none absolute bottom-0 left-1/4 w-[500px] h-[250px] bg-red-600/5 blur-3xl"></div>

	<!-- Top Navigation Bar (Hosting Platform style) -->
	<header class="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md px-6 py-4 relative z-10">
		<div class="max-w-6xl mx-auto flex items-center justify-between">
			<div class="flex items-center gap-3">
				<!-- Vercel / Cloud triangular prism icon -->
				<div class="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/60 flex items-center justify-center shadow-inner">
					<svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
						<path d="M12 2L1 21h22L12 2zm0 3.8L19.5 19H4.5L12 5.8z" />
					</svg>
				</div>
				<div>
					<div class="text-sm font-semibold tracking-tight text-white flex items-center gap-2">
						Cloud Edge Network
						<span class="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30">
							Quota Exceeded
						</span>
					</div>
					<div class="text-xs text-slate-400 font-mono">{data.host || 'erapor-pmk.titipit.id'}</div>
				</div>
			</div>

			<div class="flex items-center gap-2">
				<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono bg-slate-900 border border-slate-800 text-slate-300">
					<span class="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
					STATUS: 508 / 402
				</span>
			</div>
		</div>
	</header>

	<!-- Main Content Area -->
	<main class="flex-1 max-w-4xl w-full mx-auto px-6 py-12 flex flex-col justify-center relative z-10">
		<!-- Hero Alert Section -->
		<div class="text-center mb-10">
			<div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-950/60 border border-rose-800/60 text-rose-300 text-xs font-mono uppercase tracking-wider mb-6 shadow-lg shadow-rose-950/30">
				<svg class="w-4 h-4 text-rose-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
				</svg>
				Deployment Resource Limit Reached
			</div>

			<h1 class="text-3xl sm:text-5xl font-extrabold tracking-tight text-white mb-4">
				Server Has Reached Its Limit
			</h1>
			<p class="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
				This deployment has exceeded 100% of its allocated compute execution, bandwidth, and database transaction limits for the current billing cycle.
			</p>
			<p class="text-sm text-slate-400 max-w-xl mx-auto mt-2">
				Layanan aplikasi sementara ditangguhkan oleh sistem cloud. Silakan tingkatkan paket langganan server untuk mengaktifkan kembali akses.
			</p>
		</div>

		<!-- Resource Metrics Gauges -->
		<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
			<!-- Gauge 1: Function Execution -->
			<div class="bg-slate-900/90 border border-rose-900/40 rounded-xl p-5 shadow-sm">
				<div class="flex items-center justify-between mb-2">
					<span class="text-xs font-mono text-slate-400 uppercase tracking-wide">Serverless Execution</span>
					<span class="text-xs font-mono font-bold text-rose-400">100% (1,000,000 / 1,000,000 req)</span>
				</div>
				<div class="w-full bg-slate-800 rounded-full h-2 overflow-hidden mb-2">
					<div class="bg-rose-500 h-2 rounded-full w-full"></div>
				</div>
				<p class="text-[11px] text-slate-400">Function invocations capped. Requests return HTTP 508.</p>
			</div>

			<!-- Gauge 2: Bandwidth Egress -->
			<div class="bg-slate-900/90 border border-rose-900/40 rounded-xl p-5 shadow-sm">
				<div class="flex items-center justify-between mb-2">
					<span class="text-xs font-mono text-slate-400 uppercase tracking-wide">Edge Bandwidth Egress</span>
					<span class="text-xs font-mono font-bold text-rose-400">100.4 GB / 100 GB (Over Quota)</span>
				</div>
				<div class="w-full bg-slate-800 rounded-full h-2 overflow-hidden mb-2">
					<div class="bg-rose-500 h-2 rounded-full w-full"></div>
				</div>
				<p class="text-[11px] text-slate-400">Data transfer limit exceeded for current billing cycle.</p>
			</div>

			<!-- Gauge 3: Database Pool -->
			<div class="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm">
				<div class="flex items-center justify-between mb-2">
					<span class="text-xs font-mono text-slate-400 uppercase tracking-wide">Database Pool Connections</span>
					<span class="text-xs font-mono font-bold text-amber-400">Max Concurrent Limit</span>
				</div>
				<div class="w-full bg-slate-800 rounded-full h-2 overflow-hidden mb-2">
					<div class="bg-amber-500 h-2 rounded-full w-full"></div>
				</div>
				<p class="text-[11px] text-slate-400">Connection pools throttled to protect database integrity.</p>
			</div>

			<!-- Gauge 4: Compute Memory -->
			<div class="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm">
				<div class="flex items-center justify-between mb-2">
					<span class="text-xs font-mono text-slate-400 uppercase tracking-wide">Memory & CPU Compute</span>
					<span class="text-xs font-mono font-bold text-amber-400">Throttled (100% Capped)</span>
				</div>
				<div class="w-full bg-slate-800 rounded-full h-2 overflow-hidden mb-2">
					<div class="bg-amber-500 h-2 rounded-full w-full"></div>
				</div>
				<p class="text-[11px] text-slate-400">Instance temporarily paused pending quota replenishment.</p>
			</div>
		</div>

		<!-- Action / Please Upgrade Section -->
		<div class="bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6">
			<div>
				<h3 class="text-lg font-bold text-white mb-1 flex items-center gap-2">
					<svg class="w-5 h-5 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
					</svg>
					Please Upgrade Your Server Plan
				</h3>
				<p class="text-sm text-slate-300 max-w-xl">
					Upgrade to <strong>Pro</strong> or <strong>Enterprise Tier</strong> to uncap execution limits, expand bandwidth, and restore instantaneous 24/7 uptime for e-Rapor.
				</p>
			</div>

			<div class="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto shrink-0">
				<button
					type="button"
					onclick={() => showContactModal = true}
					class="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-white hover:bg-slate-100 text-slate-900 font-semibold text-sm transition-all shadow-md shadow-white/10 flex items-center justify-center gap-2"
				>
					<svg class="w-4 h-4 text-slate-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
					</svg>
					Upgrade Plan
				</button>

				<button
					type="button"
					onclick={handleRefresh}
					disabled={isRefreshing}
					class="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-sm transition-all flex items-center justify-center gap-2"
				>
					<svg class="w-4 h-4 {isRefreshing ? 'animate-spin' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
					</svg>
					{isRefreshing ? 'Checking...' : 'Check Status'}
				</button>
			</div>
		</div>

		<!-- Diagnostic Footprint -->
		<div class="mt-8 pt-6 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 font-mono gap-3">
			<div class="flex items-center gap-3 flex-wrap">
				<span>Ray ID: <strong class="text-slate-300">{incidentId}</strong></span>
				<span>•</span>
				<span>Region: <strong class="text-slate-300">sin1 (Singapore)</strong></span>
				<span>•</span>
				<span>Client IP: <strong class="text-slate-300">Protected</strong></span>
			</div>

			<button
				type="button"
				onclick={copyIncidentId}
				class="hover:text-slate-300 transition-colors underline decoration-slate-700 underline-offset-4"
			>
				{copied ? 'Copied to clipboard' : 'Copy diagnostic details'}
			</button>
		</div>
	</main>

	<!-- Footer -->
	<footer class="border-t border-slate-900/80 bg-slate-950 px-6 py-6 text-center text-xs text-slate-400">
		<p>Cloud Server Infrastructure • Edge Network Protection • HTTP 508 Resource Limit Reached</p>
	</footer>
</div>

<!-- Modal Contact / Upgrade Plan -->
{#if showContactModal}
	<div class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
		<div class="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
			<div class="flex items-start justify-between mb-4">
				<div>
					<h4 class="text-lg font-bold text-white">Upgrade Server Tier</h4>
					<p class="text-xs text-slate-400">Pilihan paket peningkatan sumber daya server</p>
				</div>
				<button
					type="button"
					aria-label="Tutup"
					onclick={() => showContactModal = false}
					class="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
				>
					<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<div class="space-y-3 mb-6 text-sm">
				<div class="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-3">
					<div class="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 shrink-0"></div>
					<div>
						<div class="font-semibold text-white">Pro Tier (Recommended)</div>
						<div class="text-xs text-slate-400 mt-0.5">10x Function Execution, 1 TB Bandwidth, Unlimited DB pool. Cocok untuk input nilai puncak satu sekolah.</div>
					</div>
				</div>

				<div class="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-3">
					<div class="w-2 h-2 rounded-full bg-blue-400 mt-1.5 shrink-0"></div>
					<div>
						<div class="font-semibold text-white">Enterprise Dedicated</div>
						<div class="text-xs text-slate-400 mt-0.5">Dedicated VPS/Instance, Uncapped bandwidth, 99.99% SLA, backup harian otomatis.</div>
					</div>
				</div>
			</div>

			<div class="p-4 rounded-xl bg-rose-950/40 border border-rose-900/50 mb-6 text-xs text-rose-200">
				<strong class="font-semibold block mb-1">Hubungi Administrator / Pengembang:</strong>
				Silakan hubungi admin sekolah atau tim IT untuk konfirmasi perpanjangan/upgrade kuota hosting agar layanan dapat dibuka kembali segera.
			</div>

			<div class="flex items-center justify-end gap-3">
				<button
					type="button"
					onclick={() => showContactModal = false}
					class="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs transition-colors"
				>
					Tutup
				</button>
			</div>
		</div>
	</div>
{/if}
