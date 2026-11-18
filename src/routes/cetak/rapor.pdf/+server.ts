import { getRaporPreviewPayload } from '../rapor/preview-data';
import { assertCanPreviewMuridPdf } from '$lib/server/route-utils';
import { generatePDF } from '$lib/server/pdf/generate';
import { buildUrl } from '$lib/server/pdf/request-params';
import type { RequestHandler } from './$types';

async function handle({ locals, url }: { locals: App.Locals; url: URL }) {
	await assertCanPreviewMuridPdf(locals, url);

	const payload = await getRaporPreviewPayload({ locals, url });
	const pdfBuffer = await generatePDF(
		'rapor',
		payload.raporData as unknown as Record<string, unknown>
	);

	const filename = `Rapor_${payload.raporData?.murid?.nama || 'dokumen'}_${payload.raporData?.periode?.tahunPelajaran || ''}_${payload.raporData?.periode?.semester || ''}.pdf`;

	return new Response(new Blob([pdfBuffer as BlobPart], { type: 'application/pdf' }), {
		headers: {
			'Content-Disposition': `inline; filename="${filename}"`,
			'Cache-Control': 'no-store, no-cache, must-revalidate'
		}
	});
}

export const GET = (async (event) => handle(event)) satisfies RequestHandler;
export const POST = (async (event) => {
	const url = await buildUrl(event.request, event.url);
	return handle({ locals: event.locals, url });
}) satisfies RequestHandler;
