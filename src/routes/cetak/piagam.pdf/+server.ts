import { getPiagamPreviewPayload } from '../piagam/preview-data';
import { assertCanPreviewMuridPdf } from '$lib/server/route-utils';
import { generatePDF } from '$lib/server/pdf/generate';
import { buildUrl } from '$lib/server/pdf/request-params';
import type { RequestHandler } from './$types';

async function handle({ locals, url }: { locals: App.Locals; url: URL }) {
	await assertCanPreviewMuridPdf(locals, url);
	const payload = await getPiagamPreviewPayload({ locals, url });
	const template = (url.searchParams.get('template') as '1' | '2') || '1';
	const pdfBuffer = await generatePDF(
		'piagam',
		payload.piagamData as unknown as Record<string, unknown>,
		template
	);

	const filename = `Piagam_${payload.piagamData?.murid?.nama?.replace(/\s+/g, '_') || 'dokumen'}.pdf`;

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
