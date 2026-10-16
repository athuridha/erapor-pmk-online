import path from 'node:path';
import { env as dynamicEnv } from '$env/dynamic/private';

/**
 * Root directory for all user data (uploads, ttd, dinas-luar, sounds,
 * csrf-origins, ...). On Windows installs this must live in
 * %LOCALAPPDATA%\erapor-pmk-data (outside the app install dir) so it survives
 * upgrades/uninstalls; elsewhere it falls back to <cwd>/data next to the DB.
 *
 * Resolution order:
 *   1. ERAPOR_PMK_DATA_DIR env (explicit override, e.g. set by the installer)
 *   2. Windows: %LOCALAPPDATA%\erapor-pmk-data
 *   3. Fallback: <cwd>/data
 */
export function dataRoot(): string {
	const override =
		dynamicEnv.ERAPOR_PMK_DATA_DIR ||
		process.env.ERAPOR_PMK_DATA_DIR ||
		dynamicEnv.ERAPOR_PMK_DATA_DIR ||
		process.env.ERAPOR_PMK_DATA_DIR;
	if (override) return path.resolve(override);
	return defaultDataRoot();
}

/** The data root used when DATA_DIR is not set (platform default). */
export function defaultDataRoot(): string {
	if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
		return path.join(process.env.LOCALAPPDATA, 'erapor-pmk-data');
	}
	return path.resolve(process.cwd(), 'data');
}

/** Parse a `file:<path>` env value (like photo/sounds) or fall back to a default dir. */
function dirFromEnv(value: string | undefined, fallback: string): string {
	if (!value) return fallback;
	return path.resolve(value.startsWith('file:') ? value.slice(5) : value);
}

/** Directory for uploaded murid photos (honors `photo` env). */
export function uploadsDir(): string {
	return dirFromEnv(process.env.photo, path.join(dataRoot(), 'uploads'));
}

/** Directory for bel sounds (honors `sounds` env). */
export function soundsDir(): string {
	return dirFromEnv(process.env.sounds, path.join(dataRoot(), 'sounds'));
}
