import { json } from '@sveltejs/kit';
import { assertCanPreviewMuridPdf } from '$lib/server/route-utils';
import { getCoverPreviewPayload } from '../cover/preview-data';
import type { RequestHandler } from './$types';

export const GET = (async ({ locals, url }) => {
	await assertCanPreviewMuridPdf(locals, url);
	const payload = await getCoverPreviewPayload({ locals, url });
	return json(payload);
}) satisfies RequestHandler;
