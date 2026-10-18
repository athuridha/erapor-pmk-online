interface ModalAction {
	label: string;
	icon?: IconName;
	class?: string;
	/** renders the action as an anchor (opened in a new tab) instead of a button */
	href?: string;
	action?: (params: { close: () => void }) => MaybePromise<void>;
}

// Modal bodies may be any Svelte 5 component; prop matching is decoupled via
// `bodyProps`. The host renders bodies dynamically, so the expected props must
// be indefinitely wide — strict prop typing here would reject every
// concrete body component (contravariant required props).
type ModalBodyComponent = import('svelte').Component<
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	any,
	Record<string, unknown>,
	string
>;

interface ModalProps<BodyProps extends Record<string, unknown> = Record<string, unknown>> {
	title?: string;
	body: string | ModalBodyComponent;
	bodyProps?: BodyProps;
	dismissible?: boolean;
	/** wraps the body in a `prose` container (typographic spacing) */
	typography?: boolean;
	/** spread action buttons across the footer (left vs right) instead of right-aligning them */
	spreadActions?: boolean;
	onPositive?: ModalAction;
	onNeutral?: ModalAction;
	onNegative?: ModalAction;
	/** renders an additional action (e.g. link) before onPositive */
	onExtra?: ModalAction;
	onClose?: () => void;
}

interface Toast {
	id?: string;
	message: string;
	type?: 'info' | 'success' | 'warning' | 'error';
	/** if true, toast will not close automatically */
	persist?: boolean;
}
