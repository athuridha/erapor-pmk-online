import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { renderHTMLWithCustom } from '$lib/server/pdf/generate';
import { normalisasiCustomCetak, type CustomCetak } from '$lib/server/cetak/customization';
import { getBiodataPreviewPayload } from '../../biodata/preview-data';
import { getCoverPreviewPayload } from '../../cover/preview-data';
import { getPiagamPreviewPayload } from '../../piagam/preview-data';
import { getRaporPreviewPayload } from '../../rapor/preview-data';

type Dokumen = 'cover' | 'biodata' | 'rapor' | 'piagam';

function pastikanAdmin(loci: App.Locals) {
	const user = loci.user as { type?: string } | null;
	if (!user || (user.type !== 'admin' && user.type !== 'kepala_sekolah')) {
		throw error(403, 'Kustomisasi cetak hanya bisa diubah admin dan kepala sekolah.');
	}
}

/**
 * Preview langsung (HTML) dari dokumen cetak dengan pengaturan kustom yang
 * belum disimpan. Dipakai halaman Kustomisasi untuk live preview.
 */
export const POST = (async ({ request, locals, url }) => {
	pastikanAdmin(locals);

	const body = (await request.json().catch(() => ({}))) as {
		doc?: string;
		muridId?: number;
		template?: '1' | '2';
		custom?: CustomCetak;
	};

	const doc = (body.doc ?? 'rapor') as Dokumen;
	if (!['cover', 'biodata', 'rapor', 'piagam'].includes(doc)) {
		throw error(400, 'Dokumen tidak dikenal.');
	}

	const muridId = Number(body.muridId ?? 0);
	if (!Number.isInteger(muridId) || muridId <= 0) {
		throw error(400, 'Pilih satu murid untuk preview.');
	}

	const custom = normalisasiCustomCetak(body.custom ?? {});
	const previewUrl = new URL(url.origin);
	previewUrl.searchParams.set('murid_id', String(muridId));
	previewUrl.searchParams.set('bg_logo', '1');

	let html: string;
	if (doc === 'cover') {
		const payload = await getCoverPreviewPayload({ locals, url: previewUrl });
		html = renderHTMLWithCustom('cover', payload.coverData as never, undefined, custom);
	} else if (doc === 'biodata') {
		const payload = await getBiodataPreviewPayload({ locals, url: previewUrl });
		html = renderHTMLWithCustom('biodata', payload.biodataData as never, undefined, custom);
	} else if (doc === 'piagam') {
		const payload = await getPiagamPreviewPayload({ locals, url: previewUrl });
		html = renderHTMLWithCustom(
			'piagam',
			payload.piagamData as never,
			body.template ?? '1',
			custom
		);
	} else {
		const payload = await getRaporPreviewPayload({ locals, url: previewUrl });
		html = renderHTMLWithCustom('rapor', payload.raporData as never, undefined, custom);
	}

	return json({ html });
}) satisfies RequestHandler;
