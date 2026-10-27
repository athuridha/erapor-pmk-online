import { buatTemplateBuffer } from '$lib/server/import-data/template';
import { authority } from '../../../pengguna/utils.server';

export async function GET() {
	authority('informasi_umum_sekolah');

	const buffer = await buatTemplateBuffer();
	return new Response(new Uint8Array(buffer), {
		headers: {
			'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'content-disposition': 'attachment; filename="template-import-data-pokok.xlsx"',
			'cache-control': 'no-store'
		}
	});
}
