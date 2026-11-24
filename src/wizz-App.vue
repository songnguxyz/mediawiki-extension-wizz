<template>
	<cdx-dialog
		v-model:open="open"
		class="wizz-dialog"
		:title="$i18n( 'wizz-ui-title' ).text()"
		:use-close-button="true"
		:primary-action="state ? { label: $i18n( 'wizz-ui-save' ).text(), actionType: 'progressive', disabled: saving } : undefined"
		:default-action="{ label: $i18n( 'wizz-ui-cancel' ).text() }"
		@primary="onSave"
		@default="open = false"
		@update:open="onOpen"
	>
		<cdx-message
			v-if="error"
			type="error"
			:inline="true"
		>
			{{ errorText }}
		</cdx-message>
		<p v-if="error && editUrl" class="wizz-form__links">
			<a :href="editUrl">{{ $i18n( 'wizz-ui-editsource' ).text() }}</a>
		</p>
		<form
			v-if="state"
			class="wizz-form"
			@submit.prevent="onSave"
		>
			<wizz-field
				v-for="f in state.fields"
				:key="f.param"
				:field="f"
				@update:model-value="onInput( f, $event )"
			></wizz-field>
			<cdx-message
				v-if="notice"
				:type="notice.type"
				:inline="true"
			>
				{{ notice.text }}
			</cdx-message>
		</form>
	</cdx-dialog>
</template>

<script>
import { CdxDialog, CdxMessage } from '@wikimedia/codex';
import WizzField from './wizz-Field.vue';
import { applyEdits, buildSummary } from './wizz-editor.js';
import { save } from './wizz-save.js';

export default {
	components: { CdxDialog, CdxMessage, WizzField },
	props: {
		// FormState, or null when the form is refused
		state: { type: Object, default: null },
		// { code, line?, message? } when the form is refused
		error: { type: Object, default: null },
		api: { type: Object, required: true },
		summaryMsg: { type: Function, required: true }
	},
	data() {
		return { open: true, saving: false, notice: null };
	},
	computed: {
		errorText() {
			const { code, line, message } = this.error;
			return mw.messages.exists( code ) ? mw.msg( code, line ) : message || code;
		},
		editUrl() {
			return ( this.error.code === 'wizz-noinfobox' || this.error.code === 'wizz-parseerror' ) ?
				mw.util.getUrl( mw.config.get( 'wgPageName' ), { action: 'edit' } ) : null;
		}
	},
	methods: {
		onInput( field, value ) {
			field.value = value;
			field.dirty = value !== field.initial;
			this.notice = null;
		},
		// Closing: drop ?wizz so a reload shows the page (research R9).
		onOpen( open ) {
			if ( !open ) {
				const url = new URL( location.href );
				url.searchParams.delete( 'wizz' );
				url.searchParams.delete( 'wizzinstance' );
				history.replaceState( null, '', url );
			}
		},
		onSave() {
			const dirty = this.state.fields.filter( ( f ) => f.dirty );
			const changes = {};
			for ( const f of dirty ) {
				changes[ f.param ] = f.type === 'BOOLEAN' ? f.booleanValues[ f.value ? 0 : 1 ] : f.value;
			}
			this.saving = true;
			return Promise.resolve().then( () => {
				const text = applyEdits( this.state.text, this.state.call, changes );
				const summary = buildSummary( dirty.map( ( f ) => f.param ), this.summaryMsg );
				return save( this.api, this.state, text, summary );
			} ).then( ( { result } ) => {
				if ( result === 'nochange' ) {
					this.notice = { type: 'notice', text: mw.msg( 'wizz-ui-nochange' ) };
				} else {
					const url = new URL( location.href );
					url.searchParams.delete( 'wizz' );
					url.searchParams.delete( 'wizzinstance' );
					location.assign( url );
				}
			}, ( e ) => {
				let text = mw.msg( 'wizz-error-save', e.message );
				if ( e.code === 'wizz-unsafevalue' ) {
					text = mw.msg( 'wizz-unsafevalue' );
				} else if ( e.code === 'wizz-parseerror' ) {
					text = mw.msg( 'wizz-parseerror', e.line );
				}
				this.notice = { type: 'error', text };
			} ).then( () => {
				this.saving = false;
			} );
		}
	}
};
</script>
