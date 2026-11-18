<script lang="ts">
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import { setLoading } from '$lib/components/global-modal.svelte';
	import Icon from '$lib/components/icon.svelte';

	interface TujuanPembelajaranItem {
		id: number;
		deskripsi: string;
		lingkupMateri: string;
		mataPelajaranId: number;
	}

	interface MataPelajaranItem {
		id: number;
		nama: string;
		kode: string | null;
	}

	interface EditData {
		id: number;
		kelasId: number;
		mataPelajaranId: number;
		lingkupMateri: string;
		tujuanPembelajaranId: number | null;
		catatan: string;
	}

	interface Props {
		editData: EditData | null;
		tanggal?: string;
		kelasId?: number;
		mapelId?: number | null;
		mataPelajaranList: MataPelajaranItem[];
		tujuanPembelajaranList: TujuanPembelajaranItem[];
		onAction?: (actions: { submit: () => void }) => void;
		onSuccess?: (params: { data?: Record<string, unknown> }) => void | Promise<void>;
	}

	let {
		editData,
		tanggal,
		kelasId,
		mapelId,
		mataPelajaranList,
		tujuanPembelajaranList,
		onAction,
		onSuccess
	}: Props = $props();

	const defaultKelasId = $derived(editData?.kelasId ?? kelasId ?? 0);
	const defaultMapelId = $derived(editData?.mataPelajaranId ?? mapelId ?? 0);

	// Form state
	// svelte-ignore state_referenced_locally
	let formKelasId = $state(defaultKelasId);
	// svelte-ignore state_referenced_locally
	let formMapelId = $state(defaultMapelId);
	// svelte-ignore state_referenced_locally
	let formLingkupMateri = $state(editData?.lingkupMateri ?? '');
	// svelte-ignore state_referenced_locally
	let formTujuanPembelajaranId = $state(editData?.tujuanPembelajaranId ?? null);
	// svelte-ignore state_referenced_locally
	let formCatatan = $state(editData?.catatan ?? '');

	const formId = 'tambah-jurnal-form';

	const filteredLingkupMateri = $derived.by(() => {
		const set = new Set<string>();
		for (const tp of tujuanPembelajaranList) {
			if (formMapelId && tp.mataPelajaranId === formMapelId && tp.lingkupMateri) {
				set.add(tp.lingkupMateri);
			}
		}
		return Array.from(set).sort();
	});

	const filteredTujuanPembelajaran = $derived.by(() => {
		return tujuanPembelajaranList.filter(
			(tp) =>
				tp.lingkupMateri === formLingkupMateri &&
				(formMapelId === 0 || tp.mataPelajaranId === formMapelId)
		);
	});

	function handleSuccess({ data }: { form: HTMLFormElement; data?: Record<string, unknown> }) {
		void onSuccess?.({ data });
	}

	$effect(() => {
		onAction?.({
			submit: () => (document.getElementById(formId) as HTMLFormElement | null)?.requestSubmit()
		});
	});

	// When mapel changes, reset lingkupMateri if current selection is invalid
	$effect(() => {
		if (formLingkupMateri && !filteredLingkupMateri.includes(formLingkupMateri)) {
			formLingkupMateri = '';
			formTujuanPembelajaranId = null;
		}
	});

	// When lingkup materi changes, reset TP if current TP doesn't belong to the new lingkup
	$effect(() => {
		if (formLingkupMateri && formTujuanPembelajaranId) {
			const valid = filteredTujuanPembelajaran.some((tp) => tp.id === formTujuanPembelajaranId);
			if (!valid) {
				formTujuanPembelajaranId = null;
			}
		}
	});
</script>

<FormEnhance
	action="?/save"
	id={formId}
	class="space-y-4"
	onsuccess={handleSuccess}
	submitStateChange={setLoading}
>
	<input type="hidden" name="id" value={editData?.id ?? ''} />
	<input type="hidden" name="kelasId" value={formKelasId} />
	<input type="hidden" name="tanggal" value={tanggal ?? ''} />

	{#if mataPelajaranList.length > 0}
		<fieldset class="space-y-1.5">
			<label class="block text-xs font-medium text-slate-700 dark:text-zinc-300" for="jurnal-mapel"
				>Mata Pelajaran</label
			>
			<div class="relative flex items-center">
				<select
					id="jurnal-mapel"
					class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
					name="mataPelajaranId"
					value={formMapelId}
					onchange={(e) => {
						formMapelId = Number((e.currentTarget as HTMLSelectElement).value);
					}}
				>
					<option value="" disabled>Pilih Mata Pelajaran</option>
					{#each mataPelajaranList as mp (mp.id)}
						<option value={mp.id}>{mp.nama}</option>
					{/each}
				</select>
				<span
					aria-hidden="true"
					class="pointer-events-none absolute right-2.5 flex items-center text-slate-400 dark:text-zinc-400"
				>
					<Icon name="down" class="h-3.5 w-3.5" />
				</span>
			</div>
		</fieldset>
	{/if}

	<fieldset class="space-y-1.5">
		<label class="block text-xs font-medium text-slate-700 dark:text-zinc-300" for="jurnal-lingkup"
			>Lingkup Materi</label
		>
		<div class="relative flex items-center">
			<select
				id="jurnal-lingkup"
				class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
				name="lingkupMateri"
				value={formLingkupMateri}
				onchange={(e) => {
					formLingkupMateri = (e.currentTarget as HTMLSelectElement).value;
				}}
				required
			>
				<option value="" disabled>Pilih Lingkup Materi</option>
				{#each filteredLingkupMateri as lm (lm)}
					<option value={lm}>{lm}</option>
				{/each}
			</select>
			<span
				aria-hidden="true"
				class="pointer-events-none absolute right-2.5 flex items-center text-slate-400 dark:text-zinc-400"
			>
				<Icon name="down" class="h-3.5 w-3.5" />
			</span>
		</div>
	</fieldset>

	<fieldset class="space-y-1.5">
		<label class="block text-xs font-medium text-slate-700 dark:text-zinc-300" for="jurnal-tp"
			>Tujuan Pembelajaran</label
		>
		<div class="relative flex items-center">
			<select
				id="jurnal-tp"
				class="h-9 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
				name="tujuanPembelajaranId"
				value={formTujuanPembelajaranId ?? ''}
				onchange={(e) => {
					const val = (e.currentTarget as HTMLSelectElement).value;
					formTujuanPembelajaranId = val ? Number(val) : null;
				}}
			>
				<option value="">Pilih Tujuan Pembelajaran</option>
				{#each filteredTujuanPembelajaran as tp (tp.id)}
					<option value={tp.id}>{tp.deskripsi}</option>
				{/each}
			</select>
			<span
				aria-hidden="true"
				class="pointer-events-none absolute right-2.5 flex items-center text-slate-400 dark:text-zinc-400"
			>
				<Icon name="down" class="h-3.5 w-3.5" />
			</span>
		</div>
		{#if !formLingkupMateri}
			<p class="text-[11px] text-slate-500 dark:text-zinc-400">
				Pilih lingkup materi terlebih dahulu
			</p>
		{/if}
	</fieldset>

	<fieldset class="space-y-1.5">
		<label class="block text-xs font-medium text-slate-700 dark:text-zinc-300" for="jurnal-catatan"
			>Catatan</label
		>
		<textarea
			id="jurnal-catatan"
			class="min-h-24 w-full rounded-xl border border-[#7e8b9b] bg-white p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
			name="catatan"
			rows="3"
			maxlength="300"
			value={formCatatan}
			oninput={(e) => {
				formCatatan = (e.currentTarget as HTMLTextAreaElement).value;
			}}
			placeholder="Tuliskan catatan (maksimal 300 karakter)"
			spellcheck="false"></textarea>
		<p class="text-[11px] text-slate-500 dark:text-zinc-400">{formCatatan.length}/300 karakter</p>
	</fieldset>
</FormEnhance>
