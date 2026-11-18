<script lang="ts">
	import FormEnhance from '$lib/components/form-enhance.svelte';
	import Icon from '$lib/components/icon.svelte';
	import { showModal } from '$lib/components/global-modal.svelte';
	import Authority from '../authority.svelte';
	import { groupedUserPermissions } from '../permissions';
	import ResetPermissionsBody from './reset-permissions-body.svelte';

	let { data } = $props();
	let user = $derived(data.userDetail);

	function formatRole(t?: string) {
		if (!t) return '';
		return t
			.replace(/_/g, ' ')
			.split(' ')
			.map((s) => s.charAt(0).toUpperCase() + s.slice(1))
			.join(' ');
	}

	function handleSaveSuccess({
		data: successData
	}: {
		form?: HTMLFormElement;
		data?: Record<string, unknown>;
	}) {
		if (successData && 'permissions' in successData && Array.isArray(successData.permissions)) {
			// update local user object so checkboxes reflect new permissions immediately
			user = { ...user, permissions: successData.permissions as UserPermission[] };
		}
	}

	function confirmResetPermissions() {
		showModal({
			title: 'Reset Izin ke Default',
			body: ResetPermissionsBody,
			bodyProps: {
				username: user.username,
				roleType: formatRole(user.type)
			},
			onPositive: {
				label: 'Reset',
				class: 'btn-warning',
				action: ({ close }) => {
					close();
					(
						document.getElementById('reset-permissions-form') as HTMLFormElement | null
					)?.requestSubmit();
				}
			},
			onNegative: {
				label: 'Batal'
			}
		});
	}
</script>

<section
	class="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
>
	<header
		class="mb-5 flex flex-col items-start justify-between gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center dark:border-zinc-800"
	>
		<div>
			<h1 class="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
				Izin Pengguna: {user.username}
			</h1>
			<p class="mt-0.5 text-xs text-slate-600 dark:text-zinc-400">
				Atur hak akses untuk pengguna ini.
			</p>
		</div>
		{#if user.type}
			<span
				class="inline-flex items-center rounded-full border border-blue-200/80 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/50 dark:text-blue-300"
				>{formatRole(user.type)}</span
			>
		{/if}
	</header>
	<FormEnhance id="set-permissions-form" action="?/set_permissions" onsuccess={handleSaveSuccess}>
		<div
			class="overflow-x-auto rounded-xl border border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900"
		>
			<table class="w-full border-collapse text-xs">
				<thead>
					<tr
						class="border-b border-slate-200 bg-slate-50/75 text-left font-semibold text-slate-700 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300"
					>
						<th class="w-[90%] px-3 py-2.5">Izin</th>
						<th class="px-3 py-2.5 text-center">Aktif</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-200/70 dark:divide-zinc-800">
					{#each Object.entries(groupedUserPermissions) as [group, permission] (group)}
						<tr class="bg-slate-50/70 dark:bg-zinc-800/40">
							<td colspan="2" class="px-3 py-2 font-bold text-slate-900 dark:text-zinc-100"
								>{permission.description}</td
							>
						</tr>
						{#each permission.values as [name, desc] (name)}
							{@const key = `${group}_${name}` as UserPermission}
							{@const isAdmin = user.type === 'admin'}
							{@const checked = isAdmin || user.permissions.includes(key)}
							<tr class="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40">
								<td class="py-2 pr-3 pl-7 text-slate-700 dark:text-zinc-300">{desc}</td>
								<td class="px-3 py-2 text-center">
									{#if isAdmin}
										<!-- Ensure the permission is submitted even if checkbox is disabled -->
										<input type="hidden" name={key} value="true" />
										<input
											type="checkbox"
											class="toggle toggle-sm checked:border-blue-600 checked:bg-blue-600 checked:text-white"
											name={key}
											value="true"
											checked
											disabled
										/>
									{:else}
										<input
											type="checkbox"
											class="toggle toggle-sm checked:border-blue-600 checked:bg-blue-600 checked:text-white"
											name={key}
											value="true"
											{checked}
										/>
									{/if}
								</td>
							</tr>
						{/each}
					{/each}
				</tbody>
			</table>
		</div>
	</FormEnhance>

	<div
		class="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-zinc-800"
	>
		<Authority permissions={['user_set_permissions']}>
			<a
				href="/master-data/pengguna"
				class="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#7e8b9b] bg-white px-3.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
			>
				<Icon name="left" class="h-4 w-4" />
				Kembali
			</a>
		</Authority>
		<div class="flex flex-wrap justify-end gap-2">
			{#if user.type !== 'admin'}
				<FormEnhance
					id="reset-permissions-form"
					action="?/reset_permissions"
					onsuccess={handleSaveSuccess}
				>
					<Authority permissions={['user_set_permissions']}>
						<button
							type="button"
							class="inline-flex h-9 items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-300 dark:hover:bg-amber-950/80"
							onclick={confirmResetPermissions}
						>
							<Icon name="repeat" class="h-4 w-4" />
							Reset ke Default
						</button>
					</Authority>
				</FormEnhance>
			{/if}
			<Authority permissions={['user_set_permissions']}>
				<button
					form="set-permissions-form"
					type="submit"
					class="inline-flex h-9 items-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
				>
					<Icon name="save" class="h-4 w-4" />
					Simpan
				</button>
			</Authority>
		</div>
	</div>
</section>
