<script lang="ts">
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();
</script>

<div
	class="rounded-2xl border border-slate-200/75 bg-white shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-900"
>
	<header
		class="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5 dark:border-zinc-800"
	>
		<div>
			<h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">Wali Kelas</h1>
			<p class="mt-0.5 text-xs text-slate-600 dark:text-zinc-400">
				Pilih kelas wali untuk tiap guru. Satu guru hanya menjadi wali satu kelas.
			</p>
		</div>
		{#if data.semesterNama}
			<span
				class="inline-flex h-8 w-fit items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
			>
				<span aria-hidden="true" class="text-blue-600 dark:text-blue-400">
					<Icon name="calendar" class="h-3.5 w-3.5" />
				</span>
				<span>{data.semesterNama}</span>
			</span>
		{/if}
	</header>

	<div class="p-4 sm:p-5">
		{#if data.pegawai.length === 0}
			<div
				class="rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-zinc-700"
			>
				<p class="text-sm font-semibold text-slate-800 dark:text-zinc-200">
					Belum ada data pegawai
				</p>
				<p class="mt-1 text-xs text-slate-600 dark:text-zinc-400">
					Tambahkan pegawai/guru terlebih dahulu, lalu atur wali kelasnya di sini.
				</p>
			</div>
		{:else}
			<div class="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-zinc-800">
				<table class="w-full min-w-[640px] border-collapse text-left text-sm">
					<thead
						class="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold text-slate-600 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300"
					>
						<tr>
							<th class="px-3.5 py-2.5">Guru</th>
							<th class="px-3.5 py-2.5">NIP</th>
							<th class="w-72 px-3.5 py-2.5">Kelas Wali</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-200/70 dark:divide-zinc-800">
						{#each data.pegawai as guru (guru.id)}
							{@const kelasWali = data.waliKelasByPegawai[guru.id] ?? ''}
							<tr class="transition-colors hover:bg-slate-50/80 dark:hover:bg-zinc-800/40">
								<td class="px-3.5 py-3 font-semibold text-slate-900 dark:text-zinc-100">
									{guru.nama}
								</td>
								<td class="px-3.5 py-3 text-xs text-slate-600 tabular-nums dark:text-zinc-300">
									{guru.nip || '-'}
								</td>
								<td class="px-3.5 py-2.5">
									<FormEnhance action="?/setWali" showToast={true}>
										{#snippet children({ submitting })}
											<input type="hidden" name="pegawaiId" value={guru.id} />
											<div class="relative flex items-center">
												<select
													name="kelasId"
													value={kelasWali}
													disabled={submitting}
													title="Kelas wali untuk {guru.nama}"
													aria-label="Kelas wali untuk {guru.nama}"
													class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 transition-colors focus:border-blue-600 focus:outline-none disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
													onchange={(event) => event.currentTarget.form?.requestSubmit()}
												>
													<option value="">Belum menjadi wali kelas</option>
													{#each data.kelas as kelas (kelas.id)}
														<option value={kelas.id}>
															{kelas.nama}{kelas.fase ? ` (${kelas.fase})` : ''}
														</option>
													{/each}
												</select>
												<span
													aria-hidden="true"
													class="pointer-events-none absolute right-2.5 flex items-center text-slate-500 dark:text-zinc-400"
												>
													<Icon name="down" class="h-3.5 w-3.5" />
												</span>
											</div>
										{/snippet}
									</FormEnhance>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</div>
