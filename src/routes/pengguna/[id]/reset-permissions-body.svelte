<script lang="ts">
	let { username, roleType } = $props<{ username: string; roleType: string }>();
</script>

<p class="text-xs leading-relaxed text-slate-600 dark:text-zinc-300">
	Izin <strong class="font-semibold text-slate-900 dark:text-zinc-100">{username}</strong> akan
	dikembalikan ke pengaturan default untuk tipe
	<strong class="font-semibold text-slate-900 dark:text-zinc-100">{roleType}</strong>. Semua
	penyesuaian manual akan hilang. Lanjutkan?
</p>
