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
				v-for="f in fields"
				:key="f.param"
				:field="f"
				@update:model-value="onInput( f, $event )"
				@blur="onBlur( f )"
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
import { save, findMissing } from './wizz-save.js';
import { validateField, validatePattern, mustExistErrors, itemsOf } from './wizz-validate.js';

export default {
	components: { CdxDialog, CdxMessage, WizzField },
	props: {
		// FormState, or null when the form is refused
		state: { type: Object, default: null },
		// { code, line?, message? } when the form is refused
		error: { type: Object, default: null },
		api: { type: Object, required: true },
		summaryMsg: { type: Function, required: true },
		// { source, createWorker? } of the regex worker, see testPattern
		regex: { type: Object, default: null }
	},
	data() {
		// Reactive view of the state's fields (the state itself is not deeply reactive).
		return {
			open: true,
			saving: false,
			notice: null,
			fields: this.state ? this.state.fields : [],
			// Latest check per field: a slower, older check must not overwrite a newer one.
			latest: {}
		};
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
		checkOptions() {
			return { nsIds: mw.config.get( 'wgNamespaceIds' ) };
		},
		// Rules that need no network, plus the pattern; sets the field's errors and warnings.
		validate( field ) {
			const value = field.value;
			const token = ( this.latest[ field.param ] || 0 ) + 1;
			this.latest[ field.param ] = token;
			const { errors, warnings } = validateField( field, value, this.checkOptions() );
			const patternErrors = !errors.length && field.dirty && this.regex ?
				validatePattern( field, value, this.regex ) : Promise.resolve( [] );
			return patternErrors.then( ( more ) => {
				if ( this.latest[ field.param ] === token ) {
					field.errors = errors.concat( more );
					field.warnings = warnings;
				}
			} );
		},
		// Must-exist (contracts/api-calls.md request 4): one query for all the given fields.
		checkExist( fields ) {
			const todo = fields.filter( ( f ) => f.dirty && !f.errors.length && f.rules.mustExist );
			const titles = [].concat( ...todo.map( ( f ) => itemsOf( f, f.value ) ) );
			return findMissing( this.api, titles ).then( ( missing ) => {
				for ( const f of todo ) {
					f.errors = mustExistErrors( f, f.value, missing );
				}
			} );
		},
		onInput( field, value ) {
			field.value = value;
			field.dirty = value !== field.initial;
			this.notice = null;
			return this.validate( field );
		},
		onBlur( field ) {
			// ponytail: a failed query is left to the save, which repeats it and reports it.
			return this.validate( field )
				.then( () => this.checkExist( [ field ] ) )
				.catch( () => {} );
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
			const dirty = this.fields.filter( ( f ) => f.dirty );
			let blocked = false;
			this.saving = true;
			// FR-009: every rule before the request; any error stops here.
			return Promise.all( dirty.map( ( f ) => this.validate( f ) ) )
				.then( () => this.checkExist( dirty ) )
				.then( () => {
					if ( dirty.some( ( f ) => f.errors.length ) ) {
						this.notice = { type: 'error', text: mw.msg( 'wizz-error-blocked' ) };
						blocked = true;
						return null;
					}
					const changes = {};
					for ( const f of dirty ) {
						changes[ f.param ] = f.type === 'BOOLEAN' ? f.booleanValues[ f.value ? 0 : 1 ] : f.value;
					}
					const text = applyEdits( this.state.text, this.state.call, changes );
					const summary = buildSummary( dirty.map( ( f ) => f.param ), this.summaryMsg );
					return save( this.api, this.state, text, summary );
				} )
				.then( ( saved ) => {
					if ( !saved ) {
						return;
					}
					if ( saved.result === 'nochange' ) {
						this.notice = { type: 'notice', text: mw.msg( 'wizz-ui-nochange' ) };
					} else {
						const url = new URL( location.href );
						url.searchParams.delete( 'wizz' );
						url.searchParams.delete( 'wizzinstance' );
						location.assign( url );
					}
				}, ( e ) => {
					let text = mw.msg( 'wizz-error-save', e.message || e );
					if ( e.code === 'wizz-unsafevalue' ) {
						text = mw.msg( 'wizz-unsafevalue' );
					} else if ( e.code === 'wizz-parseerror' ) {
						text = mw.msg( 'wizz-parseerror', e.line );
					}
					this.notice = { type: 'error', text };
				} ).then( () => {
					this.saving = false;
					// After the button is enabled again, or it would take the focus back.
					if ( blocked ) {
						this.$nextTick( () => this.focusFirstError() );
					}
				} );
		},
		focusFirstError() {
			// The dialog is teleported, so it is not under this.$el.
			const bad = document.querySelector( '.wizz-dialog .cdx-text-input--status-error input, .wizz-dialog .cdx-text-area--status-error textarea' );
			if ( bad ) {
				bad.focus();
			}
		}
	},
	created() {
		// FR-015: values already invalid on the page get a warning, nothing else.
		for ( const f of this.fields ) {
			f.warnings = validateField( f, f.value, this.checkOptions() ).warnings;
		}
	}
};
</script>
