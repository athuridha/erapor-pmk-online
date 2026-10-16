import { ensureSchema } from './ensure-helper';

const CLOUD_SYNC = 'cloud_sync';

export async function ensureCloudSyncSchema() {
	await ensureSchema(CLOUD_SYNC, [
		`CREATE TABLE IF NOT EXISTS cloud_sync_settings (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			sekolah_id INTEGER NOT NULL REFERENCES sekolah(id) ON DELETE CASCADE,
			account_id TEXT,
			database_id TEXT DEFAULT '766ffcd4-c49f-4f29-ab20-dddc0215bb89',
			api_token TEXT,
			last_pulled_at TEXT,
			last_pushed_at TEXT,
			last_checksum TEXT,
			created_at TEXT NOT NULL,
			updated_at TEXT,
			UNIQUE(sekolah_id)
		)`,
		`CREATE TABLE IF NOT EXISTS cloud_sync_logs (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			sekolah_id INTEGER NOT NULL REFERENCES sekolah(id) ON DELETE CASCADE,
			user_id INTEGER REFERENCES auth_user(id) ON DELETE SET NULL,
			action TEXT NOT NULL,
			status TEXT NOT NULL,
			total_records INTEGER DEFAULT 0,
			summary TEXT,
			error_message TEXT,
			created_at TEXT NOT NULL,
			updated_at TEXT
		)`,
		`CREATE TABLE IF NOT EXISTS cloud_packages (
			id TEXT PRIMARY KEY,
			sekolah_id INTEGER NOT NULL REFERENCES sekolah(id) ON DELETE CASCADE,
			package_type TEXT DEFAULT 'guru_grades' NOT NULL,
			teacher_name TEXT,
			teacher_username TEXT,
			checksum TEXT NOT NULL,
			payload_json TEXT NOT NULL,
			status TEXT DEFAULT 'PENDING' NOT NULL,
			notes TEXT,
			approved_at TEXT,
			approved_by INTEGER REFERENCES auth_user(id) ON DELETE SET NULL,
			created_at TEXT NOT NULL,
			updated_at TEXT
		)`,
		`CREATE INDEX IF NOT EXISTS cloud_packages_sekolah_idx ON cloud_packages(sekolah_id)`,
		`CREATE INDEX IF NOT EXISTS cloud_packages_status_idx ON cloud_packages(status)`
	]);
}
