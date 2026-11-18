<script lang="ts">
	type AcademicContext = {
		activeSemesterId: number | null;
		tahunAjaranList: Array<{
			nama: string;
			semester: Array<{ id: number; nama: string }>;
		}>;
	} | null;

	let {
		headingTitle = '',
		kelasAktifLabel = null,
		academicContext = null
	}: {
		headingTitle: string;
		kelasAktifLabel: string | null;
		academicContext: AcademicContext;
	} = $props();

	const activeSemester = $derived.by(() => {
		const context = academicContext;
		if (!context?.activeSemesterId) return null;
		for (const tahun of context.tahunAjaranList ?? []) {
			const match = tahun.semester.find((item) => item.id === context.activeSemesterId);
			if (match) {
				return {
					...match,
					tahunAjaranNama: tahun.nama
				};
			}
		}
		return null;
	});
</script>

<div
	class="mb-4 flex flex-col gap-2 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between dark:border-zinc-800"
>
	<div>
		<h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
			{headingTitle}
		</h1>
		{#if kelasAktifLabel}
			<p class="mt-0.5 block text-xs text-slate-600 dark:text-zinc-400">
				{kelasAktifLabel}
				{#if activeSemester}
					&middot; Semester {activeSemester.nama} ({activeSemester.tahunAjaranNama})
				{:else if academicContext?.activeSemesterId}
					&middot; Semester aktif tidak ditemukan dalam daftar tahun ajaran.
				{:else}
					&middot; Semester belum disetel di menu Rapor.
				{/if}
			</p>
		{/if}
	</div>
</div>
