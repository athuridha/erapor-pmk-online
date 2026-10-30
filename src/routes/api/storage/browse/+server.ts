import fs from 'node:fs/promises';
import path from 'node:path';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listDirectories, listRootDrives, type BrowseResponse } from '$lib/server/storage-browse';
import { isFullAdmin } from '../../../pengguna/permissions';
import { dataRoot } from '$lib/server/data-dirs';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!isFullAdmin(locals.user)) {
		error(403, 'Hanya admin yang dapat menjelajah folder.');
	}

	const allowedRoot = path.resolve(dataRoot());
	const requested = url.searchParams.get('path')?.trim() ?? '';
	const subName = url.searchParams.get('name')?.trim() ?? '';

	// No path -> data root (drives on Windows for initial navigation hint).
	if (!requested) {
		const root = allowedRoot;
		let entries: string[] = [];
		try {
			entries = await listDirectories(root);
		} catch {
			error(400, 'Folder data tidak dapat dibaca.');
		}
		const drives = process.platform === 'win32' ? await listRootDrives() : [];
		return json({ current: root, parent: null, entries, drives } satisfies BrowseResponse);
	}

	// Resolve server-side so sub-folder names join with the correct separator.
	const dir = subName ? path.resolve(requested, subName) : path.resolve(requested);
	const current = dir;

	// Containment check: restrict browsing to dataRoot only
	if (!dir.startsWith(allowedRoot + path.sep) && dir !== allowedRoot) {
		error(403, 'Akses ke direktori di luar folder data ditolak.');
	}

	let parent: string | null;
	let drives: string[] = [];

	let stat;
	try {
		stat = await fs.stat(dir);
	} catch {
		error(400, 'Folder tidak ditemukan atau tidak dapat diakses.');
	}
	if (!stat.isDirectory()) {
		error(400, 'Path yang dipilih bukan folder.');
	}

	const root = path.parse(dir).root;
	if (process.platform === 'win32' && path.dirname(dir) === dir) {
		parent = null;
		drives = await listRootDrives();
	} else {
		parent = dir === allowedRoot ? null : path.dirname(dir);
	}

	let entries: string[] = [];
	try {
		entries = await listDirectories(dir);
	} catch {
		error(400, 'Folder tidak dapat dibaca.');
	}

	return json({ current, parent, entries, drives } satisfies BrowseResponse);
};
