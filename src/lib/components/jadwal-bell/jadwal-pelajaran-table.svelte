<script lang="ts">
	import Icon from '$lib/components/icon.svelte';
	import { touchDragSource, dropTarget } from '$lib/touch-drag.svelte';

	interface DragPayload {
		hari: string;
		jamKe: number;
		kelasId?: number;
		kode: string;
	}

	let {
		scrollEl = $bindable(null),
		hariList,
		kelasTerurut,
		hariMaxJam,
		waktuMatrix,
		kodeMerged,
		kodeNamaMap,
		badgeColorMap,
		canManage,
		isEditing,
		getKode,
		isAllSame,
		formatHari,
		onDragStart,
		onDragEnd,
		onDrop,
		onClearCell,
		onCopyBelow
	}: {
		scrollEl?: HTMLDivElement | null;
		hariList: string[];
		kelasTerurut: { id: number; nama: string }[];
		hariMaxJam: Record<string, number>;
		waktuMatrix: Record<string, Record<number, { start: string; end: string }>>;
		kodeMerged: Set<string>;
		kodeNamaMap: Map<string, string>;
		badgeColorMap: Record<string, string>;
		canManage: boolean;
		isEditing: boolean;
		getKode: (hari: string, jamKe: number, kelasId: number) => string;
		isAllSame: (hari: string, jamKe: number) => string | null;
		formatHari: (hari: string) => string;
		onDragStart: (payload: DragPayload) => void;
		onDragEnd: () => void;
		onDrop: (e: DragEvent, hari: string, jamKe: number, kelasId?: number) => void;
		onClearCell: (hari: string, jamKe: number, kelasId?: number) => void;
		onCopyBelow: (hari: string, jamKe: number, kelasId?: number) => void;
	} = $props();
</script>

<div
	bind:this={scrollEl}
	class="overflow-x-auto overflow-y-auto rounded-2xl border border-slate-200/75 bg-white shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-900"
>
	<table class="w-full border-collapse text-left text-xs">
		<thead class="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm dark:bg-zinc-800/95">
			<tr
				class="border-b border-slate-200/80 text-[11px] font-semibold tracking-wider text-slate-500 uppercase dark:border-zinc-700 dark:text-zinc-400"
			>
				<th rowspan="2" class="w-0 border-r border-slate-200/70 px-3 py-2.5 dark:border-zinc-700"
					>Hari</th
				>
				<th
					rowspan="2"
					class="w-0 border-r border-slate-200/70 px-2.5 py-2.5 text-center dark:border-zinc-700"
					>Jam</th
				>
				<th rowspan="2" class="w-0 border-r border-slate-200/70 px-3 py-2.5 dark:border-zinc-700"
					>Waktu</th
				>
				<th
					colspan={kelasTerurut.length}
					class="border-b border-slate-200/70 px-3 py-1.5 text-center dark:border-zinc-700"
				>
					{kelasTerurut.length > 0 ? 'Kelas' : ''}
				</th>
			</tr>
			<tr
				class="border-b border-slate-200/80 text-[11px] font-semibold text-slate-600 dark:border-zinc-700 dark:text-zinc-300"
			>
				{#each kelasTerurut as kelas (kelas.id)}
					<th
						class="min-w-[70px] max-w-[15ch] truncate border-r border-slate-200/60 px-2 py-2 text-center last:border-r-0 dark:border-zinc-700/70"
						title={kelas.nama}>{kelas.nama.slice(0, 15)}{kelas.nama.length > 15 ? '…' : ''}</th
					>
				{/each}
			</tr>
		</thead>
		<tbody class="divide-y divide-slate-200/70 dark:divide-zinc-800">
			{#each hariList as hari (hari)}
				{#each Array.from({ length: hariMaxJam[hari] }, (_, i) => i + 1) as jamKe (jamKe)}
					{@const allSame = isAllSame(hari, jamKe)}
					{@const waktu = waktuMatrix[hari]?.[jamKe] ?? { start: '--:--', end: '--:--' }}
					<tr class="transition-colors hover:bg-slate-50/70 dark:hover:bg-zinc-800/35">
						{#if jamKe === 1}
							<td
								rowspan={hariMaxJam[hari]}
								class="border-r border-slate-200/70 px-3 py-2 align-top font-semibold text-slate-800 dark:border-zinc-800 dark:text-zinc-200"
							>
								{formatHari(hari)}
							</td>
						{/if}
						<td
							class="border-r border-slate-200/70 px-2.5 py-2 text-center font-medium text-slate-600 dark:border-zinc-800 dark:text-zinc-300"
							>{jamKe}</td
						>
						<td
							class="border-r border-slate-200/70 px-3 py-2 text-[11px] whitespace-nowrap text-slate-500 tabular-nums dark:border-zinc-800 dark:text-zinc-400"
						>
							{#if jamKe === hariMaxJam[hari]}
								{waktu.start}
							{:else}
								{waktu.start} - {waktu.end}
							{/if}
						</td>
						{#if kodeMerged.has(allSame ?? '') || (!canManage && allSame)}
							<td
								colspan={kelasTerurut.length}
								class="h-full px-2 py-1.5 text-center align-middle"
								ondragover={(e) => e.preventDefault()}
								ondrop={(e) => onDrop(e, hari, jamKe)}
								use:dropTarget={{ enabled: canManage && isEditing }}
							>
								<div class="flex h-full w-full items-center justify-center">
									{#if canManage && isEditing}
										<div class="flex w-full items-center gap-1">
											{#if jamKe < hariMaxJam[hari] && allSame}
												<button
													type="button"
													class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-sky-200/80 bg-sky-50 text-sky-700 transition-colors hover:bg-sky-100 dark:border-sky-900/50 dark:bg-sky-950/50 dark:text-sky-300 dark:hover:bg-sky-950"
													onclick={() => onCopyBelow(hari, jamKe)}
													aria-label="Salin ke bawah"
												>
													<Icon name="copy" class="h-3 w-3" />
												</button>
											{/if}
											<span
												role="button"
												tabindex="-1"
												class="inline-flex grow cursor-grab items-center justify-center rounded-lg border px-2 py-0.5 text-[11px] font-semibold {badgeColorMap[
													allSame ?? ''
												] ??
													'border-blue-200/80 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/50 dark:text-blue-300'}"
												draggable="true"
												ondragstart={(e) => {
													if (!canManage || !isEditing) return;
													onDragStart({ hari, jamKe, kode: allSame! });
													e.dataTransfer!.setData('text/plain', allSame!);
												}}
												ondragend={onDragEnd}
												use:touchDragSource={{
													enabled: canManage && isEditing && allSame !== null,
													dragData: () => ({ kode: allSame! }),
													onDragStart: () => onDragStart({ hari, jamKe, kode: allSame! })
												}}
											>
												{kodeNamaMap.get(allSame!) ?? allSame}
											</span>
											<button
												type="button"
												class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-red-200/80 bg-red-50 text-red-700 transition-colors hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950"
												onclick={() => onClearCell(hari, jamKe)}
												aria-label="Hapus {allSame}"
											>
												<Icon name="del" class="h-3 w-3" />
											</button>
										</div>
									{:else}
										<span
											class="inline-flex w-full items-center justify-center rounded-lg border px-2 py-0.5 text-[11px] font-semibold {badgeColorMap[
												allSame ?? ''
											] ??
												'border-blue-200/80 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/50 dark:text-blue-300'}"
										>
											{kodeNamaMap.get(allSame!) ?? allSame}
										</span>
									{/if}
								</div>
							</td>
						{:else}
							{#each kelasTerurut as kelas (kelas.id)}
								{@const kode = getKode(hari, jamKe, kelas.id)}
								<td
									class="border-r border-slate-200/60 px-1.5 py-1.5 text-center last:border-r-0 dark:border-zinc-800/70"
									ondragover={(e) => e.preventDefault()}
									ondrop={(e) => onDrop(e, hari, jamKe, kelas.id)}
									use:dropTarget={{ enabled: canManage && isEditing }}
								>
									{#if canManage && isEditing}
										{#if kode}
											<div class="inline-flex items-center gap-0.5">
												{#if jamKe < hariMaxJam[hari]}
													<button
														type="button"
														class="inline-flex h-6 w-6 items-center justify-center rounded-md border border-sky-200/80 bg-sky-50 text-sky-700 transition-colors hover:bg-sky-100 dark:border-sky-900/50 dark:bg-sky-950/50 dark:text-sky-300 dark:hover:bg-sky-950"
														onclick={() => onCopyBelow(hari, jamKe, kelas.id)}
														aria-label="Salin ke bawah"
													>
														<Icon name="copy" class="h-3 w-3" />
													</button>
												{/if}
												<span
													role="button"
													tabindex="-1"
													class="inline-flex cursor-grab items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold {badgeColorMap[
														kode
													] ??
														'border-blue-200/80 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/50 dark:text-blue-300'}"
													draggable="true"
													ondragstart={(e) => {
														if (!canManage || !isEditing || !kode) return;
														onDragStart({ hari, jamKe, kelasId: kelas.id, kode });
														e.dataTransfer!.setData('text/plain', kode);
													}}
													ondragend={onDragEnd}
													use:touchDragSource={{
														enabled: canManage && isEditing && kode !== '',
														dragData: () => ({ kode, kelasId: kelas.id }),
														onDragStart: () => onDragStart({ hari, jamKe, kelasId: kelas.id, kode })
													}}
												>
													{kodeNamaMap.get(kode) ?? kode}
												</span>
												<button
													type="button"
													class="inline-flex h-6 w-6 items-center justify-center rounded-md border border-red-200/80 bg-red-50 text-red-700 transition-colors hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950"
													onclick={() => onClearCell(hari, jamKe, kelas.id)}
													aria-label="Hapus {kode}"
												>
													<Icon name="del" class="h-3 w-3" />
												</button>
											</div>
										{:else}
											<span class="cursor-default text-xs text-slate-300 dark:text-zinc-600">-</span
											>
										{/if}
									{:else if kode}
										<span
											class="inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold {badgeColorMap[
												kode
											] ??
												'border-blue-200/80 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/50 dark:text-blue-300'}"
											>{kodeNamaMap.get(kode) ?? kode}</span
										>
									{:else}
										<span class="text-xs text-slate-300 dark:text-zinc-600">-</span>
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
