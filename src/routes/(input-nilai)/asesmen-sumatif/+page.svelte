<script lang="ts">
	/* eslint-disable @typescript-eslint/no-explicit-any -- file-level: many intentional href/goto usages and loose any/unused vars */
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Icon from '$lib/components/icon.svelte';
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import KelasKontenPicker from '$lib/components/kelas-konten-picker.svelte';
	import { autoSubmit, searchQueryMarker } from '$lib/utils';
	import { onDestroy } from 'svelte';
	import { toast } from '$lib/components/toast.svelte';
	import { invalidate } from '$app/navigation';

	import SvelteURLSearchParams from '$lib/svelte-helpers/url-search-params';
	import SumatifBobotModal from '$lib/components/sumatif-bobot-modal.svelte';
	import { downloadTemplateXLSX } from '$lib/excel/template';
	import { showModal } from '$lib/components/global-modal.svelte';
	import AgamaSelectBody from '$lib/components/asesmen-sumatif/AgamaSelectBody.svelte';
	import { agamaVariantOptions, agamaParentName } from '$lib/statics';
	import ImportModalBody from '$lib/components/asesmen-sumatif/ImportModalBody.svelte';
	import MatriksTable from '$lib/components/asesmen-sumatif/matriks-table.svelte';

	type MapelOption = { value: string; nama: string };
	type MuridRow = {
		id: number;
		no: number;
		nama: string;
		agamaLabel?: string | null;
		/** mapelId efektif baris ini (varian agama/PKS sudah di-resolve server). */
		mapelId: number | null;
		nilaiAkhirAsli?: number | null;
		nilaiRevisi?: number | null;
		nilaiAkhir: number | null;
		nilaiAkhirRts: number | null;
		naLingkup: number | null;
		sts: number | null;
		sas: number | null;
		nilaiHref: string | null;
		canNilai: boolean;
		diisiUserLain?: boolean;
		tpScores?: Record<number, number | null>;
	};

	type PageState = {
		search: string | null;
		currentPage: number;
		totalPages: number;
		// totalItems and perPage omitted when not used in this view
	};

	type PageData = {
		mapelList: MapelOption[];
		selectedMapelValue: string | null;
		selectedMapel: { id: number | null; nama: string } | null;
		relevantMapelIds?: number[];
		kelasKontenAktif?: { id: number; nama?: string; fase?: string } | null;
		kelasAktif?: { nama?: string; fase?: string } | null;
		daftarMurid: MuridRow[];
		tujuanList?: Array<{
			id: number;
			no: number;
			mataPelajaranId: number;
			deskripsi: string;
			lingkupMateri: string;
			bobot: number;
			jenisAsesmen: 'formatif' | 'sumatif' | 'as';
			teknikPenilaianId: number | null;
			teknikNama: string | null;
			teknikSingkatan: string | null;
		}>;
		teknikList?: Array<{ id: number; nama: string; singkatan: string }>;
		kkm?: number;
		isTerkunci?: boolean;
		sumatifWeights?: {
			lingkup: number;
			sts: number;
			sas: number;
			isCustom?: boolean;
			sekolahDefault?: { lingkup: number; sts: number; sas: number };
			rts?: { lingkup: number; sts: number };
		};
		allowedAgamaForUser?: string[];
		page: PageState;
	};

	let { data }: { data: PageData } = $props();

	// svelte-ignore state_referenced_locally
	let selectedMapelValue = $state(data.selectedMapelValue ?? '');
	// svelte-ignore state_referenced_locally
	let searchTerm = $state(data.page.search ?? '');
	let searchTimer: ReturnType<typeof setTimeout> | undefined;

	let tampilanMode = $state<'matriks' | 'ringkas'>('matriks');
	let mapelBobotModalOpen = $state(false);

	// Restrict editing for wali_asuh
	const canEdit = $derived.by(() => {
		const u = page.data.user as { type?: string } | null | undefined;
		return u?.type !== 'wali_asuh';
	});

	// Modal / bobot sumatif state
	let showBobotModal = $state(false);
	let bobotLingkup = $state<number>(60);
	let bobotSts = $state<number>(20);
	let bobotSas = $state<number>(20);
	let bobotLingkupRts = $state<number>(70);
	let bobotStsRts = $state<number>(30);
	let bobotLoading = $state(false);
	let bobotSaving = $state(false);
	let bobotError = $state<string | null>(null);

	async function resetBobotToDefault(rapor: string = 'ras') {
		bobotSaving = true;
		bobotError = null;
		try {
			const body =
				rapor === 'rts'
					? { lingkup: 70, sts: 30, rapor: 'rts' }
					: { lingkup: 60, sts: 20, sas: 20 };
			const res = await fetch('/api/sekolah/sumatif-bobot', {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(body)
			});
			const payload = await res.json();
			if (!res.ok) {
				throw new Error(payload?.error ?? 'Gagal mengembalikan ke default.');
			}
			toast(payload?.message ?? 'Bobot dikembalikan ke default.', 'success');
			// update local state
			if (rapor === 'rts') {
				bobotLingkupRts = 70;
				bobotStsRts = 30;
			} else {
				bobotLingkup = 60;
				bobotSts = 20;
				bobotSas = 20;
			}
			bobotError = null;
			showBobotModal = false;
			await invalidate('app:asesmen-sumatif');
			await invalidate('app:asesmen-sumatif/formulir');
		} catch (err) {
			bobotError = String((err as Error)?.message ?? 'Gagal mengembalikan ke default.');
			toast(bobotError, 'error');
		} finally {
			bobotSaving = false;
		}
	}

	// Download template as Excel (.xlsx) — delegated to modular helper in $lib
	function normalizeAgamaToKey(agama: string | null | undefined): string {
		const n = agama?.trim().toLowerCase() ?? '';
		if (n === 'islam') return 'islam';
		if (n === 'kristen' || n === 'protestan') return 'kristen';
		if (n === 'katolik' || n === 'katholik') return 'katolik';
		if (n === 'hindu') return 'hindu';
		if (n === 'buddha' || n === 'budha' || n === 'buddhist') return 'buddha';
		if (n === 'khonghucu' || n === 'konghucu' || n === 'khong hu cu') return 'konghuchu';
		return n;
	}

	async function downloadTemplate() {
		try {
			// Fetch all students in the class (bypass pagination) so the template
			// includes every student, not just the current page.
			const kelasId = ((data as any).kelasKontenAktif ?? (data as any).kelasAktif)?.id ?? null;
			let allMurid: { id: number; nama: string; agama: string }[] | null = null;
			if (kelasId) {
				try {
					const res = await fetch(`/api/murid/daftar?kelas_id=${kelasId}`);
					if (res.ok) allMurid = await res.json();
				} catch (_) {
					// fall back to paginated list below
				}
			}
			let daftarMuridExport = allMurid ?? data.daftarMurid;

			// Determine which mata pelajaran to use
			const mapelIdStr =
				selectedMapelValue ?? data.selectedMapel?.id ?? data.mapelList?.[0]?.value ?? '';
			const mapelId = Number(mapelIdStr);
			let lingkupGroups: { name: string; tpCount: number }[] | undefined = undefined;
			if (Number.isInteger(mapelId) && mapelId > 0) {
				try {
					const res = await fetch(`/api/tujuan-count/${mapelId}`);
					if (res.ok) {
						const json = await res.json();
						if (json?.groups && Array.isArray(json.groups)) {
							lingkupGroups = json.groups.map((g: { name: string; count: number }) => ({
								name: String(g.name ?? ''),
								tpCount: Number(g.count || 0)
							}));
						}
					}
				} catch (_) {
					// ignore and use defaults
				}
			}

			const currentMapelName =
				data.selectedMapel?.nama ?? data.mapelList?.[0]?.nama ?? 'Nama Mata Pelajaran';
			// If the current mapel is the generic agama mapel, prompt to choose specific agama
			if (currentMapelName === agamaParentName) {
				let getter: () => string = () => agamaVariantOptions[0].key;
				showModal({
					title: 'Pilih Agama untuk Template',
					body: AgamaSelectBody,
					bodyProps: {
						setGetter: (fn: () => string) => (getter = fn),
						options: agamaVariantOptions
					},
					onPositive: {
						label: 'Download',
						icon: 'download',
						action: async ({ close }: { close: () => void }) => {
							const chosenKey = getter();
							const chosen =
								agamaVariantOptions.find((o) => o.key === chosenKey) ?? agamaVariantOptions[0];
							close();
							try {
								// Try to resolve a local mapel id for the chosen agama variant so
								// we can fetch accurate lingkup/TP counts from the DB and include
								// the resolved mapel id in the downloaded filename.
								let finalLingkupGroups = lingkupGroups;
								let resolvedMapelId: number | null = null;
								const kelasId =
									((data as any).kelasKontenAktif ?? (data as any).kelasAktif)?.id ?? null;
								if (kelasId && chosen && chosen.name) {
									try {
										const q = new URLSearchParams({ kelas_id: String(kelasId), name: chosen.name });
										const resResolve = await fetch(`/api/mapel/resolve-by-name?${q.toString()}`);
										if (resResolve.ok) {
											const body = await resResolve.json().catch(() => ({}) as any);
											const resolvedId = Number(body?.mapelId ?? NaN);
											if (Number.isInteger(resolvedId) && resolvedId > 0) {
												resolvedMapelId = resolvedId;
												try {
													const resGroups = await fetch(`/api/tujuan-count/${resolvedId}`);
													if (resGroups.ok) {
														const json = await resGroups.json().catch(() => ({}) as any);
														if (json?.groups && Array.isArray(json.groups)) {
															finalLingkupGroups = json.groups.map(
																(g: { name: string; count: number }) => ({
																	name: String(g.name ?? ''),
																	tpCount: Number(g.count || 0)
																})
															);
														}
													}
												} catch (_) {
													// ignore and fall back to defaults
												}
											}
										}
									} catch (_) {
										// ignore resolve errors
									}
								}
								const filteredMurid = Array.isArray(daftarMuridExport)
									? daftarMuridExport.filter(
											(m: any) => !('agama' in m) || normalizeAgamaToKey(m.agama) === chosenKey
										)
									: daftarMuridExport;
								await downloadTemplateXLSX({
									mapelName: chosen.name,
									kelasName: (data.kelasKontenAktif ?? data.kelasAktif)?.nama ?? 'Nama Kelas',
									daftarMurid: filteredMurid,
									lingkupGroups: finalLingkupGroups,
									mapelId: resolvedMapelId,
									kelasId: kelasId
								});
							} catch (err) {
								toast('Gagal membuat template: ' + String((err as Error)?.message ?? err), 'error');
							}
						}
					},
					onNeutral: { label: 'Batal', icon: 'close' },
					spreadActions: true,
					dismissible: true
				});
				return;
			}

			await downloadTemplateXLSX({
				mapelName: currentMapelName,
				kelasName: (data.kelasKontenAktif ?? data.kelasAktif)?.nama ?? 'Nama Kelas',
				daftarMurid: daftarMuridExport,
				lingkupGroups,
				mapelId: Number.isInteger(mapelId) && mapelId > 0 ? mapelId : null,
				kelasId: ((data as any).kelasKontenAktif ?? (data as any).kelasAktif)?.id ?? null
			});
		} catch (err) {
			toast('Gagal membuat template: ' + String((err as Error)?.message ?? err), 'error');
		}
	}

	async function openImportModal() {
		const currentMapelName =
			data.selectedMapel?.nama ?? data.mapelList?.[0]?.nama ?? 'Nama Mata Pelajaran';

		// If the selected mata pelajaran is the generic agama parent, open the
		// file-import modal and let that modal show the agama select (so we
		// don't use a separate "Pilih Agama untuk Import" modal).
		if (currentMapelName === agamaParentName) {
			openFileImportModal(null, { showAgamaSelect: true, agamaOptions: agamaVariantOptions });
			return;
		}

		// not agama parent — resolve a numeric id when possible
		const mapelIdStr =
			selectedMapelValue ?? data.selectedMapel?.id ?? data.mapelList?.[0]?.value ?? '';
		const mapelId = Number(mapelIdStr);
		openFileImportModal(Number.isInteger(mapelId) && mapelId > 0 ? mapelId : null);
	}

	function openFileImportModal(
		resolvedMapelId: number | null,
		opts?: {
			showAgamaSelect?: boolean;
			agamaOptions?: { key: string; label: string; name: string }[];
		}
	) {
		let uploader: () => File | null = () => null;
		let agamaGetter: () => string = () => agamaVariantOptions[0].key;

		showModal({
			title: 'Import Nilai dari Excel',
			body: ImportModalBody,
			bodyProps: {
				setUploader: (fn: () => File | null) => (uploader = fn),
				// if requested, let the modal expose a getter for chosen agama key
				...(opts?.showAgamaSelect
					? {
							showAgamaSelect: true,
							agamaOptions: opts?.agamaOptions,
							setAgamaGetter: (fn: () => string) => (agamaGetter = fn)
						}
					: {})
			},
			onPositive: {
				label: 'Import',
				icon: 'import',
				action: async ({ close }: { close: () => void }) => {
					const file = uploader();
					if (!file) {
						toast('Pilih file terlebih dahulu.', 'error');
						return;
					}
					try {
						const form = new FormData();
						form.append('file', file);

						let finalMapelId: number | null = resolvedMapelId;

						// if modal had agama selector, resolve chosen agama to a mapel id
						if (opts?.showAgamaSelect) {
							const chosenKey = agamaGetter();
							const chosen =
								(opts?.agamaOptions ?? agamaVariantOptions).find((o) => o.key === chosenKey) ??
								(opts?.agamaOptions ?? agamaVariantOptions)[0];
							const kelasId = ((data as any).kelasKontenAktif ?? (data as any).kelasAktif)?.id;
							if (kelasId && chosen && chosen.name) {
								try {
									const q = new URLSearchParams({ kelas_id: String(kelasId), name: chosen.name });
									const resResolve = await fetch(`/api/mapel/resolve-by-name?${q.toString()}`);
									if (resResolve.ok) {
										const body = await resResolve.json().catch(() => ({}) as any);
										const resolvedId = Number(body?.mapelId ?? NaN);
										if (Number.isInteger(resolvedId) && resolvedId > 0) {
											finalMapelId = resolvedId;
										}
									}
								} catch (_) {
									// ignore resolve errors and fall back to selectedMapelValue
								}
							}
						}

						if (finalMapelId != null) form.append('mapel_id', String(finalMapelId));
						else
							form.append('mapel_id', selectedMapelValue ?? String(data.selectedMapel?.id ?? ''));

						const kelasId = ((data as any).kelasKontenAktif ?? (data as any).kelasAktif)?.id;
						if (kelasId) form.append('kelas_id', String(kelasId));
						const res = await fetch('/api/asesmen-sumatif/import', { method: 'POST', body: form });
						const json = await res.json().catch(() => ({}) as any);
						if (!res.ok) {
							throw new Error(json?.error ?? 'Gagal mengimpor file.');
						}
						toast(json?.message ?? 'Import selesai.', 'success');
						close();
						await invalidate('app:asesmen-sumatif');
						await invalidate('app:asesmen-sumatif/formulir');
					} catch (err) {
						toast('Gagal mengimpor: ' + String((err as Error)?.message ?? err), 'error');
					}
				}
			},
			onNeutral: { label: 'Batal', icon: 'close' },
			spreadActions: true,
			dismissible: true
		});
	}

	async function openBobotModal() {
		if (tampilanMode === 'matriks' && (data.selectedMapel?.id || data.relevantMapelIds?.length)) {
			mapelBobotModalOpen = true;
			return;
		}
		bobotLoading = true;
		bobotError = null;
		try {
			const res = await fetch('/api/sekolah/sumatif-bobot');
			if (!res.ok) throw new Error('Gagal memuat bobot.');
			const jsonData = await res.json();
			bobotLingkup = Number(jsonData.ras?.lingkup ?? 60);
			bobotSts = Number(jsonData.ras?.sts ?? 20);
			bobotSas = Number(jsonData.ras?.sas ?? 20);
			bobotLingkupRts = Number(jsonData.rts?.lingkup ?? 70);
			bobotStsRts = Number(jsonData.rts?.sts ?? 30);
			showBobotModal = true;
		} catch (err) {
			bobotError = String((err as Error)?.message ?? 'Gagal memuat bobot.');
			toast(bobotError, 'error');
		} finally {
			bobotLoading = false;
		}
	}

	async function saveBobot(event?: CustomEvent) {
		bobotSaving = true;
		bobotError = null;

		const rapor = event?.detail?.rapor ?? 'ras';

		if (rapor === 'rts') {
			const lingkupVal = event?.detail?.lingkup ?? bobotLingkupRts;
			const stsVal = event?.detail?.sts ?? bobotStsRts;

			const total = (Number(lingkupVal) || 0) + (Number(stsVal) || 0);
			if (total !== 100) {
				bobotError = 'Jumlah bobot harus berjumlah 100.';
				bobotSaving = false;
				return;
			}
			try {
				const res = await fetch('/api/sekolah/sumatif-bobot', {
					method: 'PUT',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({
						lingkup: Math.round(Number(lingkupVal)),
						sts: Math.round(Number(stsVal)),
						rapor: 'rts'
					})
				});
				const payload = await res.json();
				if (!res.ok) {
					throw new Error(payload?.error ?? 'Gagal menyimpan bobot.');
				}
				toast(payload?.message ?? 'Bobot tersimpan.', 'success');
				bobotLingkupRts = Math.round(Number(lingkupVal));
				bobotStsRts = Math.round(Number(stsVal));
				showBobotModal = false;
				await invalidate('app:asesmen-sumatif');
				await invalidate('app:asesmen-sumatif/formulir');
			} catch (err) {
				bobotError = String((err as Error)?.message ?? 'Gagal menyimpan bobot.');
				toast(bobotError, 'error');
			} finally {
				bobotSaving = false;
			}
			return;
		}

		// RAS default
		const lingkupVal = event?.detail?.lingkup ?? bobotLingkup;
		const stsVal = event?.detail?.sts ?? bobotSts;
		const sasVal = event?.detail?.sas ?? bobotSas;

		const total = (Number(lingkupVal) || 0) + (Number(stsVal) || 0) + (Number(sasVal) || 0);
		if (total !== 100) {
			bobotError = 'Jumlah bobot harus berjumlah 100.';
			bobotSaving = false;
			return;
		}
		try {
			const res = await fetch('/api/sekolah/sumatif-bobot', {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					lingkup: Math.round(Number(lingkupVal)),
					sts: Math.round(Number(stsVal)),
					sas: Math.round(Number(sasVal))
				})
			});
			const payload = await res.json();
			if (!res.ok) {
				throw new Error(payload?.error ?? 'Gagal menyimpan bobot.');
			}
			toast(payload?.message ?? 'Bobot tersimpan.', 'success');
			bobotLingkup = Math.round(Number(lingkupVal));
			bobotSts = Math.round(Number(stsVal));
			bobotSas = Math.round(Number(sasVal));
			showBobotModal = false;
			await invalidate('app:asesmen-sumatif');
			await invalidate('app:asesmen-sumatif/formulir');
		} catch (err) {
			bobotError = String((err as Error)?.message ?? 'Gagal menyimpan bobot.');
			toast(bobotError, 'error');
		} finally {
			bobotSaving = false;
		}
	}

	$effect(() => {
		const latestSelected = data.selectedMapelValue ?? '';
		if (selectedMapelValue !== latestSelected) {
			selectedMapelValue = latestSelected;
		}
	});

	$effect(() => {
		if (searchTimer) return;
		const latestSearch = data.page.search ?? '';
		if (searchTerm !== latestSearch) {
			searchTerm = latestSearch;
		}
	});

	const selectedMapelLabel = $derived.by(() => data.selectedMapel?.nama ?? null);
	const kelasLabel = $derived.by(() => (data.kelasKontenAktif ?? data.kelasAktif)?.nama ?? null);
	const hasMapel = $derived(data.mapelList.length > 0);
	const currentPage = $derived.by(() => data.page.currentPage ?? 1);
	const totalPages = $derived.by(() => Math.max(1, data.page.totalPages ?? 1));
	const pages = $derived.by(() => Array.from({ length: totalPages }, (_, index) => index + 1));
	const searchActive = $derived(Boolean(data.page.search));
	const hasResults = $derived(data.daftarMurid.length > 0);

	function formatScore(value: number | null) {
		if (value == null || Number.isNaN(value)) return '-';
		const rounded = Math.round(value * 100) / 100;
		return String(rounded);
	}

	const bobotAkhir = $derived(data.sumatifWeights ?? { lingkup: 60, sts: 20, sas: 20 });
	const totalBobotAkhir = $derived(
		Math.max(0, bobotAkhir.lingkup) + Math.max(0, bobotAkhir.sts) + Math.max(0, bobotAkhir.sas)
	);
	const bobotRts = $derived(
		data.sumatifWeights?.rts ?? { lingkup: bobotAkhir.lingkup, sts: bobotAkhir.sts }
	);
	const totalBobotRts = $derived(Math.max(0, bobotRts.lingkup) + Math.max(0, bobotRts.sts));

	function kontribusi(val: number | null, bobot: number, total: number): number | null {
		if (val == null || Number.isNaN(val) || total <= 0) return null;
		return Math.round(((val * Math.max(0, bobot)) / total) * 100) / 100;
	}

	function alasanTidakBisaNilai(murid: MuridRow): string {
		if (!canEdit) return 'Anda tidak memiliki izin untuk menilai';
		if (murid.canNilai) return 'Pilih mata pelajaran';
		if (data.allowedAgamaForUser?.length)
			return `Hanya untuk murid beragama ${data.allowedAgamaForUser.join(' / ')}`;
		return 'Anda tidak memiliki izin untuk menilai murid ini';
	}

	// ── Isi massal: centang beberapa murid lalu isi satu komponen sekaligus ──
	let terpilihMurid = $state<number[]>([]);
	let massalTerbuka = $state(false);
	let massalKomponen = $state<'lingkup' | 'sts' | 'sas'>('lingkup');
	let massalNilai = $state('');

	const KOMPONEN_LABEL: Record<'lingkup' | 'sts' | 'sas', string> = {
		lingkup: 'Formatif (F)',
		sts: 'Sumatif (S)',
		sas: 'Sumatif AS (AS)'
	};

	// Hanya baris dengan mapelId efektif & boleh dinilai yang bisa dicentang.
	const muridBisaDipilih = $derived(
		data.daftarMurid.filter((murid) => murid.mapelId != null && murid.canNilai)
	);
	const muridTerpilih = $derived(
		muridBisaDipilih.filter((murid) => terpilihMurid.includes(murid.id))
	);
	const semuaTerpilih = $derived(
		muridBisaDipilih.length > 0 && muridTerpilih.length === muridBisaDipilih.length
	);
	const itemsMassal = $derived(
		JSON.stringify(muridTerpilih.map((murid) => ({ muridId: murid.id, mapelId: murid.mapelId })))
	);

	function togglePilihMurid(id: number, checked: boolean) {
		terpilihMurid = checked
			? [...new Set([...terpilihMurid, id])]
			: terpilihMurid.filter((value) => value !== id);
	}

	function togglePilihSemua(checked: boolean) {
		terpilihMurid = checked ? muridBisaDipilih.map((murid) => murid.id) : [];
	}

	function bukaMassal() {
		if (!muridTerpilih.length) return;
		massalKomponen = 'lingkup';
		massalNilai = '';
		massalTerbuka = true;
	}

	function selesaiMassal() {
		massalTerbuka = false;
		terpilihMurid = [];
	}

	function buildSearchUrl(rawValue: string) {
		const params = new SvelteURLSearchParams(page.url.search);
		const cleaned = rawValue.trim();
		const current = params.get('q') ?? '';
		const searchChanged = cleaned !== current;
		if (cleaned) {
			params.set('q', cleaned);
		} else {
			params.delete('q');
		}
		if (searchChanged) {
			params.delete('page');
		}
		const nextQuery = params.toString();
		const nextUrl = `${page.url.pathname}${nextQuery ? `?${nextQuery}` : ''}`;
		const currentUrl = `${page.url.pathname}${page.url.search}`;
		if (nextUrl === currentUrl) {
			return null;
		}
		return nextUrl;
	}

	async function applySearch(rawValue: string) {
		const target = buildSearchUrl(rawValue);
		if (!target) return;
		searchTimer = undefined;
		await goto(target, { replaceState: true, keepFocus: true });
	}

	function buildPageUrl(pageNumber: number) {
		const params = new SvelteURLSearchParams(page.url.search);
		const sanitized = pageNumber < 1 ? 1 : pageNumber;
		if (sanitized <= 1) {
			params.delete('page');
		} else {
			params.set('page', String(sanitized));
		}
		const nextQuery = params.toString();
		const nextUrl = `${page.url.pathname}${nextQuery ? `?${nextQuery}` : ''}`;
		const currentUrl = `${page.url.pathname}${page.url.search}`;
		if (nextUrl === currentUrl) {
			return null;
		}
		return nextUrl;
	}

	async function gotoPageNumber(pageNumber: number) {
		const target = buildPageUrl(pageNumber);
		if (!target) return;
		await goto(target, { replaceState: true, keepFocus: true });
	}

	function handlePageClick(pageNumber: number) {
		if (pageNumber === currentPage) return;
		void gotoPageNumber(pageNumber);
	}

	function handleSearchInput(event: Event) {
		const value = (event.currentTarget as HTMLInputElement).value;
		searchTerm = value;
		if (searchTimer) {
			clearTimeout(searchTimer);
		}
		searchTimer = setTimeout(() => {
			searchTimer = undefined;
			void applySearch(value);
		}, 400);
	}

	function submitSearch(event: Event) {
		event.preventDefault();
		if (searchTimer) {
			clearTimeout(searchTimer);
			searchTimer = undefined;
		}
		void applySearch(searchTerm);
	}

	onDestroy(() => {
		if (searchTimer) {
			clearTimeout(searchTimer);
			searchTimer = undefined;
		}
	});
</script>

<div
	class="cursor-default rounded-2xl border border-slate-200/75 bg-white p-3 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
>
	<div class="mb-3 border-b border-slate-200 pb-3 sm:mb-4 sm:pb-4 dark:border-zinc-800">
		<h1
			class="text-lg font-bold leading-snug tracking-tight text-slate-900 sm:text-xl dark:text-zinc-100"
		>
			Penilaian{#if selectedMapelLabel}<span class="text-slate-600 dark:text-zinc-300">
					: {selectedMapelLabel}</span
				>{/if}
		</h1>
		{#if kelasLabel}
			<p class="mt-0.5 text-xs text-slate-600 dark:text-zinc-400">
				Kelas: <span class="font-medium text-slate-800 dark:text-zinc-200">{kelasLabel}</span>
			</p>
		{:else}
			<p class="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
				Pilih kelas untuk melihat mata pelajaran intrakurikuler.
			</p>
		{/if}
	</div>

	<div class="flex flex-col gap-2.5">
		<div class="flex flex-col gap-2 sm:flex-row sm:items-center">
			<KelasKontenPicker
				currentId={((data as any).kelasKontenAktif ?? (data as any).kelasAktif)?.id ?? null}
			/>
			<form class="w-full sm:w-56 md:w-72" method="get" use:autoSubmit>
				{#if ((data as any).kelasKontenAktif ?? (data as any).kelasAktif)?.id != null}
					<input
						type="hidden"
						name="kelas"
						value={String(((data as any).kelasKontenAktif ?? (data as any).kelasAktif).id)}
					/>
				{/if}
				<div class="relative flex items-center">
					<select
						class="h-11 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:h-9 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
						title="Pilih mata pelajaran"
						name="mapel_id"
						bind:value={selectedMapelValue}
						disabled={!hasMapel}
					>
						{#if !hasMapel}
							<option value="">Belum ada mata pelajaran</option>
						{:else}
							<option value="" disabled selected={selectedMapelValue === ''}>
								Pilih Mata Pelajaran
							</option>
							{#each data.mapelList as mapel (mapel.value)}
								<option value={mapel.value}>{mapel.nama}</option>
							{/each}
						{/if}
					</select>
					<span
						aria-hidden="true"
						class="pointer-events-none absolute right-2.5 flex items-center text-slate-500 dark:text-zinc-400"
					>
						<Icon name="down" class="h-3.5 w-3.5" />
					</span>
				</div>
				{#if searchTerm.trim().length}
					<input type="hidden" name="q" value={searchTerm.trim()} />
				{/if}
			</form>
		</div>
		<div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
			<!-- Mode View Switcher -->
			<div
				class="grid w-full grid-cols-2 gap-0.5 rounded-xl border border-slate-200 bg-slate-100 p-0.5 sm:flex sm:w-auto dark:border-zinc-700 dark:bg-zinc-800"
			>
				<button
					type="button"
					class="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors sm:h-8 sm:px-2.5 {tampilanMode ===
					'matriks'
						? 'bg-blue-600 text-white shadow-sm'
						: 'text-slate-600 hover:text-slate-900 dark:text-zinc-300 dark:hover:text-zinc-100'}"
					onclick={() => (tampilanMode = 'matriks')}
					title="Tampilan Matriks Spreadsheet Excel"
					aria-pressed={tampilanMode === 'matriks'}
				>
					<Icon name="table" class="h-4 w-4 sm:h-3.5 sm:w-3.5" />
					<span>Matriks</span>
				</button>
				<button
					type="button"
					class="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors sm:h-8 sm:px-2.5 {tampilanMode ===
					'ringkas'
						? 'bg-blue-600 text-white shadow-sm'
						: 'text-slate-600 hover:text-slate-900 dark:text-zinc-300 dark:hover:text-zinc-100'}"
					onclick={() => (tampilanMode = 'ringkas')}
					title="Tampilan Ringkasan"
					aria-pressed={tampilanMode === 'ringkas'}
				>
					<Icon name="edit" class="h-4 w-4 sm:h-3.5 sm:w-3.5" />
					<span>Ringkasan</span>
				</button>
			</div>

			<div class="grid grid-cols-3 gap-2 sm:flex sm:items-center">
				<button
					type="button"
					class="inline-flex h-11 items-center justify-center gap-1 rounded-xl border border-[#7e8b9b] bg-white px-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:h-8 sm:gap-1.5 sm:px-3 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
					onclick={openBobotModal}
					disabled={!canEdit}
					aria-disabled={!canEdit}
					title={!canEdit ? 'Anda tidak memiliki izin untuk mengatur bobot' : 'Atur bobot nilai'}
				>
					<Icon name="gear" class="h-4 w-4 shrink-0 sm:h-3.5 sm:w-3.5" />
					<span>Bobot</span>
				</button>
				<button
					type="button"
					class="inline-flex h-11 items-center justify-center gap-1 rounded-xl border border-[#7e8b9b] bg-white px-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:h-8 sm:gap-1.5 sm:px-3 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
					onclick={downloadTemplate}
					disabled={!canEdit}
					aria-disabled={!canEdit}
					title={!canEdit ? 'Anda tidak memiliki izin' : 'Unduh template Excel'}
				>
					<Icon name="download" class="h-4 w-4 shrink-0 sm:h-3.5 sm:w-3.5" />
					<span>Unduh</span>
				</button>
				<button
					type="button"
					class="inline-flex h-11 items-center justify-center gap-1 rounded-xl border border-[#7e8b9b] bg-white px-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:h-8 sm:gap-1.5 sm:px-3 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
					onclick={openImportModal}
					disabled={!canEdit}
					aria-disabled={!canEdit}
					title={!canEdit ? 'Anda tidak memiliki izin' : 'Import nilai dari Excel'}
				>
					<Icon name="import" class="h-4 w-4 shrink-0 sm:h-3.5 sm:w-3.5" />
					<span>Import</span>
				</button>
			</div>
		</div>
	</div>

	{#if !hasMapel}
		<div
			class="mt-5 flex items-center gap-2.5 rounded-xl border border-sky-200 bg-sky-50/90 px-4 py-3 text-xs text-sky-950 dark:border-sky-900/60 dark:bg-sky-950/35 dark:text-sky-200"
		>
			<Icon name="info" class="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
			<span>
				Belum ada mata pelajaran intrakurikuler untuk kelas ini. Tambahkan terlebih dahulu di menu
				<strong>Intrakurikuler</strong>.
			</span>
		</div>
	{:else if !hasResults}
		{#if searchActive}
			<div
				class="mt-5 flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200"
			>
				<Icon name="alert" class="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
				<span>
					Tidak ditemukan murid dengan kata kunci
					<strong>"{data.page.search}"</strong>. Coba gunakan nama lain atau hapus pencarian.
				</span>
			</div>
		{:else}
			<div
				class="mt-5 flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200"
			>
				<Icon name="alert" class="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
				<span>
					Belum ada data murid untuk kelas ini. Silakan tambah murid di menu <strong>Murid</strong>.
				</span>
			</div>
		{/if}
	{:else if tampilanMode === 'matriks'}
		<div class="mt-4">
			<MatriksTable
				muridList={data.daftarMurid}
				tujuanList={data.tujuanList ?? []}
				teknikList={data.teknikList ?? []}
				kelasFase={((data as any).kelasKontenAktif ?? (data as any).kelasAktif)?.fase ?? null}
				mapelId={data.selectedMapel?.id ?? null}
				relevantMapelIds={data.relevantMapelIds ?? []}
				kkm={data.kkm ?? 75}
				isTerkunci={data.isTerkunci ?? false}
				{canEdit}
				sumatifWeights={data.sumatifWeights ?? { lingkup: 60, sts: 20, sas: 20 }}
				mapelNama={data.selectedMapel?.nama ?? 'Mata Pelajaran'}
				bind:bobotModalOpen={mapelBobotModalOpen}
			/>
		</div>
	{:else}
		<form
			class="mt-3 w-full"
			data-sveltekit-keepfocus
			data-sveltekit-replacestate
			onsubmit={submitSearch}
		>
			<div class="relative">
				<span
					class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400 dark:text-zinc-500"
				>
					<Icon name="search" class="h-4 w-4" />
				</span>
				<input
					type="search"
					name="q"
					class="h-11 w-full rounded-xl border border-[#7e8b9b] bg-white pr-3 pl-9 text-sm text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none sm:h-9 sm:text-xs dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
					value={searchTerm}
					spellcheck="false"
					autocomplete="name"
					placeholder="Cari nama murid..."
					oninput={handleSearchInput}
				/>
			</div>
		</form>

		{#if hasResults}
			<div
				class="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 dark:border-zinc-800 dark:bg-zinc-800/40"
			>
				<p class="text-xs text-slate-600 dark:text-zinc-400">
					Centang murid untuk mengisi satu komponen nilai sekaligus.
				</p>
				<div class="flex w-full flex-wrap items-center gap-2 sm:w-auto">
					<button
						type="button"
						class="inline-flex h-10 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 sm:hidden dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
						onclick={() => togglePilihSemua(!semuaTerpilih)}
						disabled={!canEdit || !muridBisaDipilih.length}
					>
						{semuaTerpilih ? 'Batal semua' : 'Pilih semua'}
					</button>
					{#if muridTerpilih.length}
						<button
							type="button"
							class="inline-flex h-10 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 sm:h-8 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
							onclick={() => togglePilihSemua(false)}
						>
							Kosongkan
						</button>
					{/if}
					<button
						type="button"
						class="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:h-8 sm:flex-none"
						onclick={bukaMassal}
						disabled={!canEdit || !muridTerpilih.length}
						aria-disabled={!canEdit || !muridTerpilih.length}
						title={!canEdit
							? 'Anda tidak memiliki izin untuk menilai'
							: 'Isi nilai untuk murid yang dicentang'}
					>
						<Icon name="edit" class="h-3.5 w-3.5" />
						Isi Sekaligus ({muridTerpilih.length})
					</button>
				</div>
			</div>
		{/if}
		<!-- Mobile: kartu ringkasan per murid -->
		<div class="mt-3 space-y-2 sm:hidden">
			{#each data.daftarMurid as murid (murid.id)}
				{@const bisaDipilih = murid.mapelId != null && murid.canNilai && canEdit}
				<div
					class="rounded-xl border border-slate-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
				>
					<div class="flex items-start gap-2.5">
						<label class="-m-1.5 flex h-10 w-10 shrink-0 items-center justify-center">
							<input
								type="checkbox"
								class="checkbox checkbox-sm"
								checked={terpilihMurid.includes(murid.id)}
								disabled={!bisaDipilih}
								onchange={(event) => togglePilihMurid(murid.id, event.currentTarget.checked)}
								aria-label="Pilih {murid.nama}"
							/>
						</label>
						<div class="min-w-0 flex-1">
							<p class="text-sm font-semibold leading-snug text-slate-900 dark:text-zinc-100">
								<span class="mr-1 text-[11px] text-slate-400 tabular-nums dark:text-zinc-500"
									>{murid.no}.</span
								>
								{@html searchQueryMarker(data.page.search, murid.nama)}
							</p>
							{#if murid.agamaLabel}
								<p class="mt-0.5 text-[11px] text-slate-500 dark:text-zinc-400">
									{murid.agamaLabel}
								</p>
							{/if}
						</div>
						{#if murid.nilaiHref && murid.canNilai && canEdit}
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- intentional prebuilt href -->
							<a
								class="inline-flex h-10 shrink-0 items-center gap-1 rounded-xl bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
								href={murid.nilaiHref}
							>
								<Icon name="edit" class="h-3.5 w-3.5" />
								Nilai
							</a>
						{:else}
							<button
								type="button"
								class="inline-flex h-10 shrink-0 cursor-not-allowed items-center gap-1 rounded-xl border border-slate-200 bg-slate-100 px-3.5 text-xs font-semibold text-slate-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500"
								disabled
								aria-disabled="true"
								title={alasanTidakBisaNilai(murid)}
							>
								<Icon name="edit" class="h-3.5 w-3.5" />
								Nilai
							</button>
						{/if}
					</div>
					<div class="mt-2.5 grid grid-cols-2 gap-2">
						<div class="rounded-lg bg-slate-50 px-2.5 py-2 dark:bg-zinc-800/50">
							<p
								class="text-[10px] font-semibold tracking-wide text-slate-500 uppercase dark:text-zinc-400"
							>
								Tengah Semester
							</p>
							{#if murid.diisiUserLain}
								<p class="mt-0.5 text-[11px] text-slate-500 italic dark:text-zinc-400">
									Data diisi user lain
								</p>
							{:else if murid.nilaiAkhirRts != null}
								<p
									class="mt-0.5 text-base font-bold text-slate-900 tabular-nums dark:text-zinc-100"
								>
									{formatScore(murid.nilaiAkhirRts)}
								</p>
								<p class="text-[10px] text-slate-500 tabular-nums dark:text-zinc-400">
									{#if murid.naLingkup != null}F {formatScore(
											kontribusi(murid.naLingkup, bobotRts.lingkup, totalBobotRts)
										)}{/if}
									{#if murid.sts != null}
										· S {formatScore(kontribusi(murid.sts, bobotRts.sts, totalBobotRts))}{/if}
								</p>
							{:else}
								<p class="mt-0.5 text-[11px] text-slate-500 italic dark:text-zinc-400">
									Belum dinilai
								</p>
							{/if}
						</div>
						<div class="rounded-lg bg-slate-50 px-2.5 py-2 dark:bg-zinc-800/50">
							<p
								class="text-[10px] font-semibold tracking-wide text-slate-500 uppercase dark:text-zinc-400"
							>
								Rapor Semester
							</p>
							{#if murid.diisiUserLain}
								<p class="mt-0.5 text-[11px] text-slate-500 italic dark:text-zinc-400">
									Data diisi user lain
								</p>
							{:else if murid.nilaiAkhir != null}
								<p
									class="mt-0.5 flex items-center gap-1.5 text-base font-bold text-slate-900 tabular-nums dark:text-zinc-100"
								>
									<span>{formatScore(murid.nilaiAkhir)}</span>
									{#if murid.nilaiRevisi != null}
										<span
											class="rounded bg-teal-100 px-1 py-0.5 text-[9px] font-semibold text-teal-800 uppercase dark:bg-teal-950/60 dark:text-teal-300"
										>
											Revisi
										</span>
									{/if}
								</p>
								<p class="text-[10px] text-slate-500 tabular-nums dark:text-zinc-400">
									{#if murid.naLingkup != null}F {formatScore(
											kontribusi(murid.naLingkup, bobotAkhir.lingkup, totalBobotAkhir)
										)}{/if}{#if murid.sts != null}{#if murid.naLingkup != null}
											·
										{/if}S {formatScore(
											kontribusi(murid.sts, bobotAkhir.sts, totalBobotAkhir)
										)}{/if}{#if murid.sas != null}{#if murid.naLingkup != null || murid.sts != null}
											·
										{/if}AS {formatScore(
											kontribusi(murid.sas, bobotAkhir.sas, totalBobotAkhir)
										)}{/if}
								</p>
							{:else}
								<p class="mt-0.5 text-[11px] text-slate-500 italic dark:text-zinc-400">
									Belum dinilai
								</p>
							{/if}
						</div>
					</div>
				</div>
			{/each}
		</div>

		<div
			class="mt-4 hidden overflow-x-auto rounded-xl border border-slate-200 bg-white sm:block dark:border-zinc-800 dark:bg-zinc-900"
		>
			<table class="w-full min-w-140 border-collapse text-xs">
				<thead>
					<tr
						class="border-b border-slate-200 bg-slate-50 text-left font-semibold text-slate-700 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300"
					>
						<th class="px-3 py-2.5 text-center" style="width: 44px;">
							<input
								type="checkbox"
								class="checkbox checkbox-sm"
								checked={semuaTerpilih}
								disabled={!canEdit || !muridBisaDipilih.length}
								onchange={(event) => togglePilihSemua(event.currentTarget.checked)}
								title="Pilih semua murid yang bisa dinilai"
								aria-label="Pilih semua murid yang bisa dinilai"
							/>
						</th>
						<th style="width: 50px; min-width: 40px;" class="px-3 py-2.5">No</th>
						<th class="min-w-48 px-3 py-2.5">Nama</th>
						<th class="min-w-40 px-3 py-2.5">Nilai Tengah Semester</th>
						<th class="min-w-40 px-3 py-2.5">Nilai Rapor Semester</th>
						<th class="min-w-32 px-3 py-2.5">Aksi</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-200 dark:divide-zinc-800">
					{#each data.daftarMurid as murid (murid.id)}
						{@const bisaDipilih = murid.mapelId != null && murid.canNilai && canEdit}
						<tr class="transition-colors hover:bg-slate-50 dark:hover:bg-zinc-800/50">
							<td class="px-3 py-2.5 text-center">
								<input
									type="checkbox"
									class="checkbox checkbox-sm"
									checked={terpilihMurid.includes(murid.id)}
									disabled={!bisaDipilih}
									onchange={(event) => togglePilihMurid(murid.id, event.currentTarget.checked)}
									title={bisaDipilih
										? `Pilih ${murid.nama}`
										: 'Murid ini belum bisa dinilai pada mata pelajaran terpilih'}
									aria-label="Pilih {murid.nama}"
								/>
							</td>
							<td class="px-3 py-2.5 tabular-nums text-slate-600 dark:text-zinc-400">{murid.no}</td>
							<td class="px-3 py-2.5 font-medium text-slate-900 dark:text-zinc-100">
								{@html searchQueryMarker(data.page.search, murid.nama)}
								{#if murid.agamaLabel}
									<div class="mt-0.5 text-[11px] font-normal text-slate-500 dark:text-zinc-400">
										{murid.agamaLabel}
									</div>
								{/if}
							</td>
							<td class="px-3 py-2.5">
								{#if murid.diisiUserLain}
									<span class="text-xs italic text-slate-500 dark:text-zinc-400">
										Data diisi oleh user lain
									</span>
								{:else if murid.nilaiAkhirRts != null}
									<p class="font-semibold text-slate-900 tabular-nums dark:text-zinc-100">
										{formatScore(murid.nilaiAkhirRts)}
									</p>
									<div
										class="mt-1 space-y-0.5 text-[11px] text-slate-500 tabular-nums dark:text-zinc-400"
									>
										{#if murid.naLingkup != null}
											<p>
												Formatif (F): {formatScore(
													kontribusi(murid.naLingkup, bobotRts.lingkup, totalBobotRts)
												)}
											</p>
										{/if}
										{#if murid.sts != null}
											<p>
												Sumatif (S): {formatScore(
													kontribusi(murid.sts, bobotRts.sts, totalBobotRts)
												)}
											</p>
										{/if}
									</div>
								{:else}
									<span class="text-xs italic text-slate-500 dark:text-zinc-400">Belum dinilai</span
									>
								{/if}
							</td>
							<td class="px-3 py-2.5">
								{#if murid.diisiUserLain}
									<span class="text-xs italic text-slate-500 dark:text-zinc-400">
										Data diisi oleh user lain
									</span>
								{:else if murid.nilaiAkhir != null}
									<p
										class="flex items-center gap-1.5 font-semibold text-slate-900 tabular-nums dark:text-zinc-100"
									>
										<span>{formatScore(murid.nilaiAkhir)}</span>
										{#if murid.nilaiRevisi != null}
											<span
												class="rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-semibold text-teal-800 uppercase dark:bg-teal-950/60 dark:text-teal-300"
											>
												Revisi
											</span>
										{/if}
									</p>
									<div
										class="mt-1 space-y-0.5 text-[11px] text-slate-500 tabular-nums dark:text-zinc-400"
									>
										{#if murid.naLingkup != null}
											<p>
												Formatif (F): {formatScore(
													kontribusi(murid.naLingkup, bobotAkhir.lingkup, totalBobotAkhir)
												)}
											</p>
										{/if}
										{#if murid.sts != null}
											<p>
												Sumatif (S): {formatScore(
													kontribusi(murid.sts, bobotAkhir.sts, totalBobotAkhir)
												)}
											</p>
										{/if}
										{#if murid.sas != null}
											<p>
												Sumatif AS (AS): {formatScore(
													kontribusi(murid.sas, bobotAkhir.sas, totalBobotAkhir)
												)}
											</p>
										{/if}
									</div>

									<!-- modal moved to component -->
								{:else}
									<span class="text-xs italic text-slate-500 dark:text-zinc-400">Belum dinilai</span
									>
								{/if}
							</td>
							<td class="px-3 py-2.5">
								{#if murid.nilaiHref && murid.canNilai && canEdit}
									<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- intentional prebuilt href -->
									<a
										class="inline-flex h-8 items-center gap-1 rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
										href={murid.nilaiHref}
									>
										<Icon name="edit" class="h-3.5 w-3.5" />
										Nilai
									</a>
								{:else}
									<button
										type="button"
										class="inline-flex h-8 cursor-not-allowed items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 px-3 text-xs font-semibold text-slate-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500"
										disabled
										aria-disabled="true"
										title={alasanTidakBisaNilai(murid)}
									>
										<Icon name="edit" class="h-3.5 w-3.5" />
										Nilai
									</button>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		{#if pages.length > 1}
			<div class="mt-4 flex flex-wrap items-center justify-center gap-1">
				{#each pages as pageNumber (pageNumber)}
					<button
						type="button"
						class="inline-flex h-10 min-w-10 items-center justify-center rounded-xl border px-2.5 text-xs font-semibold tabular-nums transition-colors sm:h-8 sm:min-w-8 {pageNumber ===
						currentPage
							? 'border-blue-600 bg-blue-600 text-white shadow-sm'
							: 'border-[#7e8b9b] bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800'}"
						onclick={() => handlePageClick(pageNumber)}
						aria-current={pageNumber === currentPage ? 'page' : undefined}
					>
						{pageNumber}
					</button>
				{/each}
			</div>
		{/if}
	{/if}
</div>

{#if massalTerbuka && muridTerpilih.length}
	<dialog
		class="modal modal-bottom bg-slate-950/45 backdrop-blur-[2px] sm:modal-middle"
		open
		onclose={() => (massalTerbuka = false)}
	>
		<div
			class="modal-box max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-slate-200/80 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-slate-900 shadow-2xl sm:rounded-2xl sm:p-5 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
		>
			<h3 class="mb-1 text-lg font-bold">Isi Nilai Sekaligus</h3>
			<p class="mb-3 text-xs text-slate-600 dark:text-zinc-400">
				{muridTerpilih.length} murid terpilih
				{#if selectedMapelLabel}
					· {selectedMapelLabel}
				{/if}
				· nilai yang sama diberikan ke semua murid terpilih.
			</p>
			<ul
				class="mb-4 max-h-24 space-y-1 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-800/50"
			>
				{#each muridTerpilih as murid (murid.id)}
					<li class="flex items-center gap-1.5 text-slate-800 dark:text-zinc-200">
						<Icon name="check" class="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
						<span class="truncate">{murid.nama}</span>
					</li>
				{/each}
			</ul>
			<FormEnhance
				id="form-nilai-massal-sumatif"
				action="?/simpanMassal"
				onsuccess={() => selesaiMassal()}
			>
				{#snippet children({ submitting })}
					<input type="hidden" name="items" value={itemsMassal} />
					<div class="space-y-3.5">
						<div>
							<span class="mb-1 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
								Komponen nilai
							</span>
							<div class="relative flex items-center">
								<select
									name="komponen"
									class="h-11 w-full appearance-none truncate rounded-xl border border-[#7e8b9b] bg-white pr-8 pl-3 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none sm:h-9 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400"
									bind:value={massalKomponen}
									required
									disabled={submitting}
								>
									{#each Object.entries(KOMPONEN_LABEL) as [value, label] (value)}
										<option {value}>{label}</option>
									{/each}
								</select>
								<span
									aria-hidden="true"
									class="pointer-events-none absolute right-2.5 flex items-center text-slate-500 dark:text-zinc-400"
								>
									<Icon name="down" class="h-3.5 w-3.5" />
								</span>
							</div>
						</div>
						<div>
							<span class="mb-1 block text-xs font-semibold text-slate-700 dark:text-zinc-300">
								Nilai (0-100)
							</span>
							<input
								type="number"
								name="nilai"
								min="0"
								max="100"
								step="0.01"
								class="h-11 w-full rounded-xl border border-[#7e8b9b] bg-white px-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none sm:h-9 sm:text-xs dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:focus:border-blue-400"
								placeholder="Contoh: 85"
								bind:value={massalNilai}
								required
								disabled={submitting}
							/>
							<p class="mt-1.5 text-[11px] text-slate-500 dark:text-zinc-400">
								Komponen lain (mis. STS/SAS) tidak diubah.
							</p>
						</div>
					</div>
					<div
						class="mt-5 flex items-center justify-end gap-2 border-t border-slate-200 pt-3 dark:border-zinc-800"
					>
						<button
							type="button"
							class="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-50 sm:h-9 sm:flex-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
							onclick={() => (massalTerbuka = false)}
							disabled={submitting}
						>
							Batal
						</button>
						<button
							type="submit"
							class="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:h-9 sm:flex-none"
							disabled={submitting}
						>
							<Icon name="save" class="h-4 w-4" />
							Simpan ({muridTerpilih.length})
						</button>
					</div>
				{/snippet}
			</FormEnhance>
		</div>
		<button
			type="button"
			aria-label="Tutup"
			class="modal-backdrop bg-transparent"
			onclick={() => (massalTerbuka = false)}
		></button>
	</dialog>
{/if}

<!-- Sumatif bobot modal moved outside the card to avoid card focus styles -->
<SumatifBobotModal
	open={showBobotModal}
	lingkup={bobotLingkup}
	sts={bobotSts}
	sas={bobotSas}
	lingkupRts={bobotLingkupRts}
	stsRts={bobotStsRts}
	loading={bobotLoading}
	saving={bobotSaving}
	error={bobotError}
	on:close={() => (showBobotModal = false)}
	on:reset={(e) => {
		void resetBobotToDefault(e.detail.rapor);
	}}
	on:save={saveBobot}
/>
