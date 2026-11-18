const faseBadgeColors: Record<string, string> = {
	'Fase A':
		'bg-blue-50 text-blue-700 ring-blue-200/70 dark:bg-blue-950/60 dark:text-blue-300 dark:ring-blue-800/60',
	'Fase B':
		'bg-indigo-50 text-indigo-700 ring-indigo-200/70 dark:bg-indigo-950/60 dark:text-indigo-300 dark:ring-indigo-800/60',
	'Fase C':
		'bg-violet-50 text-violet-700 ring-violet-200/70 dark:bg-violet-950/60 dark:text-violet-300 dark:ring-violet-800/60',
	'Fase D':
		'bg-sky-50 text-sky-700 ring-sky-200/70 dark:bg-sky-950/60 dark:text-sky-300 dark:ring-sky-800/60',
	'Fase E':
		'bg-emerald-50 text-emerald-700 ring-emerald-200/70 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-800/60',
	'Fase F':
		'bg-amber-50 text-amber-700 ring-amber-200/70 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-800/60'
};

export const faseBadgeClass = (fase?: string | null) =>
	faseBadgeColors[fase ?? ''] ??
	'bg-slate-100 text-slate-700 ring-slate-200/70 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700';
