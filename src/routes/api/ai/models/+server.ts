import { json } from '@sveltejs/kit';
import { getAiSettings } from '$lib/server/ai';
import { isFullAdmin } from '../../../pengguna/permissions';

const TIMEOUT_MS = 20_000;

function normalisasiBaseUrl(raw: string): string | null {
	let value = raw.trim();
	if (!value) return null;
	if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
	try {
		const url = new URL(value);
		if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
		return url.toString();
	} catch {
		return null;
	}
}

export const POST = async ({ request, locals }) => {
	if (!isFullAdmin(locals.user)) {
		return json({ message: 'Hanya admin yang dapat mengatur integrasi AI.' }, { status: 403 });
	}

	const body = (await request.json().catch(() => ({}))) as {
		baseUrl?: string;
		apiKey?: string;
	};
	const stored = await getAiSettings();
	const apiKey = (body.apiKey ?? '').trim() || stored?.apiKey || '';
	const rawBase = (body.baseUrl ?? '').trim() || stored?.baseUrl || '';
	const baseUrl = normalisasiBaseUrl(rawBase);

	if (!apiKey) {
		return json({ message: 'Kunci API belum diisi.' }, { status: 400 });
	}
	if (!baseUrl) {
		return json({ message: 'Base URL tidak valid.' }, { status: 400 });
	}

	const isGemini = /generativelanguage\.googleapis\.com/i.test(baseUrl);
	const headers: Record<string, string> = { accept: 'application/json' };

	let endpoint: string;
	if (isGemini) {
		const origin = new URL(baseUrl).origin;
		endpoint = `${origin}/v1beta/models`;
		headers['x-goog-api-key'] = apiKey;
	} else {
		endpoint = `${baseUrl.replace(/\/+$/, '')}/models`;
		headers.authorization = `Bearer ${apiKey}`;
	}

	try {
		const response = await fetch(endpoint, {
			headers,
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
		const payload = (await response.json().catch(() => null)) as {
			models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
			data?: Array<{ id?: string }>;
		} | null;
		if (!response.ok || !payload) {
			return json(
				{ message: `Penyedia AI menolak permintaan (HTTP ${response.status}).` },
				{ status: 502 }
			);
		}

		const models = isGemini
			? (payload.models ?? [])
					.filter((model) => (model.supportedGenerationMethods ?? []).includes('generateContent'))
					.map((model) => (model.name ?? '').replace(/^models\//, ''))
					.filter(Boolean)
			: (payload.data ?? []).map((model) => model.id ?? '').filter(Boolean);

		return json({ models: [...new Set(models)].sort((a, b) => a.localeCompare(b)) });
	} catch (error) {
		const message =
			(error as Error)?.name === 'TimeoutError'
				? 'Penyedia AI tidak merespons (timeout).'
				: 'Gagal menghubungi penyedia AI. Periksa base URL dan koneksi.';
		return json({ message }, { status: 502 });
	}
};
