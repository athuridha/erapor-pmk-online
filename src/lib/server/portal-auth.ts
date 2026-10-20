import crypto from 'node:crypto';

const PBKDF2_ITERATIONS = 120_000;
const KEY_BYTES = 32;

export function normalizePhone(value: string | null | undefined): string | null {
	if (!value) return null;
	let digits = value.replace(/[^\d]/g, '');
	if (digits.startsWith('62')) digits = '0' + digits.slice(2);
	else if (digits.startsWith('8')) digits = '0' + digits;
	if (digits.length < 9 || digits.length > 15) return null;
	return digits;
}

export function defaultPortalPassword(phone: string): string {
	return phone.slice(-6);
}

export function hashPortalPassword(
	password: string,
	saltBase64?: string
): { hash: string; salt: string } {
	const salt = saltBase64 ? Buffer.from(saltBase64, 'base64') : crypto.randomBytes(16);
	const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_BYTES, 'sha256');
	return { hash: hash.toString('base64'), salt: salt.toString('base64') };
}

export function verifyPortalPassword(
	password: string,
	hashBase64: string,
	saltBase64: string
): boolean {
	try {
		const candidate = hashPortalPassword(password, saltBase64).hash;
		const a = Buffer.from(candidate, 'base64');
		const b = Buffer.from(hashBase64, 'base64');
		return a.length === b.length && crypto.timingSafeEqual(a, b);
	} catch {
		return false;
	}
}
