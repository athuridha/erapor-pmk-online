import { fail, redirect, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	countLocalMaster,
	isLocalMasterEmpty,
	pullMasterDataFromCloud
} from '$lib/server/cloud-master';
import { getD1Config, testD1Connection } from '$lib/server/cloudflare-d1';
import { getAppVersion } from '$lib/server/app-info';

/**
 * Halaman penyiapan sebelum login.
 *
 * Dipakai saat instalasi baru: database lokal masih kosong, jadi belum ada akun
 * sekolah yang bisa dipakai masuk. Dari sini operator menarik master data
 * (sekolah, pegawai, kelas, siswa, sampai akun pengguna) dari Database Pusat,
 * baru kemudian login seperti biasa.
 *
 * Dua penjaga, keduanya wajib:
 * 1. Hanya dari komputer ini sendiri (loopback). Aplikasi ini server lokal —
 *    tanpa batas ini, siapa pun di jaringan sekolah bisa memicu penarikan dan
 *    menimpa database lokal tanpa login.
 * 2. Hanya saat database lokal masih kosong. Setelah terisi, halaman ini mati
 *    dan permintaan dialihkan ke /login supaya tidak ada penimpaan data.
 */

const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1', 'localhost']);

function isLocalRequest(getClientAddress: () => string) {
	try {
		return LOOPBACK_ADDRESSES.has(getClientAddress());
	} catch {
		return false;
	}
}

async function ensureSetupAllowed(getClientAddress: () => string) {
	if (!isLocalRequest(getClientAddress)) {
		throw error(
			403,
			'Halaman penyiapan hanya bisa dibuka dari komputer yang menjalankan aplikasi.'
		);
	}
	if (!(await isLocalMasterEmpty())) {
		throw redirect(303, '/login');
	}
}

export const load: PageServerLoad = async ({ getClientAddress, url }) => {
	await ensureSetupAllowed(getClientAddress);

	const counts = await countLocalMaster();
	const config = await getD1Config(0);

	const meta: PageMeta = {
		title: 'Penyiapan Awal',
		description: 'Tarik master data dari Database Pusat sebelum masuk ke e-Rapor SMK Pratama Mulya.'
	};

	return {
		meta,
		appVersion: getAppVersion(),
		counts,
		credentials: {
			ready: Boolean(config.apiToken && (config.apiUrl || config.accountId)),
			tokenSource: config.tokenSource,
			wranglerTokenExpired: config.wranglerTokenExpired,
			databaseId: config.databaseId
		},
		selfUrl: `${url.origin}/siapkan`
	};
};

export const actions: Actions = {
	test: async ({ getClientAddress }) => {
		await ensureSetupAllowed(getClientAddress);
		try {
			const result = await testD1Connection(0);
			if (!result.ok) {
				return fail(400, { message: result.message, step: 'test' });
			}
			return { success: true, message: result.message, step: 'test' };
		} catch (err) {
			return fail(500, {
				message: err instanceof Error ? err.message : 'Tes koneksi gagal dijalankan.',
				step: 'test'
			});
		}
	},

	pull: async ({ getClientAddress }) => {
		await ensureSetupAllowed(getClientAddress);
		try {
			const result = await pullMasterDataFromCloud(0, null);
			if (!result.success) {
				return fail(400, { message: result.message, step: 'pull' });
			}
			return {
				success: true,
				message: result.message,
				step: 'pull',
				totalRecords: result.totalRecords,
				counts: result.counts
			};
		} catch (err) {
			return fail(500, {
				message: err instanceof Error ? err.message : 'Penarikan master data gagal.',
				step: 'pull'
			});
		}
	}
};
