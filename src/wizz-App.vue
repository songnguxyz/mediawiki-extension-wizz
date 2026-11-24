<template>
	<cdx-dialog
		v-model:open="open"
		class="wizz-dialog"
		:title="$i18n( 'wizz-ui-title' ).text()"
		:use-close-button="true"
		:primary-action="state && !preview ? { label: ( review ? $i18n( 'wizz-ui-save' ) : $i18n( 'wizz-ui-review' ) ).text(), actionType: 'progressive', disabled: saving } : undefined"
		:default-action="{ label: ( review ? $i18n( 'wizz-ui-back' ) : $i18n( 'wizz-ui-cancel' ) ).text() }"
		@primary="review ? onSave() : onReview()"
		@default="onDefault"
		@update:open="onOpen"
	>
		<cdx-message
			v-if="error"
			type="error"
			:inline="true"
		>
			{{ errorText }}
			<ul v-if="error.list">
				<li v-for="e in error.list" :key="e">
					{{ e }}
				</li>
			</ul>
		</cdx-message>
		<p v-if="error && editUrl" class="wizz-form__links">
			<a :href="editUrl">{{ $i18n( 'wizz-ui-editsource' ).text() }}</a>
		</p>
		<form
			v-if="state && !review"
			class="wizz-form"
			@submit.prevent="onReview"
		>
			<wizz-field
				v-for="f in fields"
				:key="f.param"
				:field="f"
				@update:model-value="onInput( f, $event )"
				@blur="onBlur( f )"
			></wizz-field>
		</form>
		<form
			v-else-if="review"
			class="wizz-review"
			@submit.prevent="onSave"
		>
			<h3>{{ $i18n( 'wizz-ui-preview-heading' ).text() }}</h3>
			<!-- Core-parsed HTML of action=parse, the only v-html besides the diff. -->
			<!-- eslint-disable-next-line vue/no-v-html -->
			<div class="wizz-review__box" v-html="review.html"></div>
			<h3>{{ $i18n( 'wizz-ui-diff-heading' ).text() }}</h3>
			<div class="wizz-review__box">
				<table class="diff diff-editfont-monospace">
					<colgroup>
						<col class="diff-marker">
						<col class="diff-content">
						<col class="diff-marker">
						<col class="diff-content">
					</colgroup>
					<!-- Core-built rows of action=compare. -->
					<!-- eslint-disable-next-line vue/no-v-html -->
					<tbody v-html="review.diff"></tbody>
				</table>
			</div>
			<cdx-field v-if="captcha && ( captcha.question || captcha.url )" class="wizz-captcha">
				<img
					v-if="captcha.url"
					:src="captcha.url"
					:alt="$i18n( 'wizz-captcha-image-label' ).text()"
				>
				<cdx-text-input v-model="captchaWord" autocomplete="off"></cdx-text-input>
				<template #label>
					{{ captcha.question || $i18n( 'wizz-captcha-image-label' ).text() }}
				</template>
			</cdx-field>
		</form>
		<cdx-message
			v-if="notice"
			:type="notice.type"
			:inline="true"
		>
			{{ notice.text }}
		</cdx-message>
	</cdx-dialog>
</template>

<script>
import { CdxDialog, CdxField, CdxMessage, CdxTextInput } from '@wikimedia/codex';
import WizzField from './wizz-Field.vue';
import { applyEdits, buildSummary } from './wizz-editor.js';
import { save, preview, findMissing } from './wizz-save.js';
import { keepDirty } from './wizz-state.js';
import { validateField, validatePattern, mustExistErrors, itemsOf } from './wizz-validate.js';

export default {
	components: { CdxDialog, CdxField, CdxMessage, CdxTextInput, WizzField },
	props: {
		// FormState, or null when the form is refused
		state: { type: Object, default: null },
		// true: opened from a definition page, nothing may be saved (FR-029)
		preview: { type: Boolean, default: false },
		// { code, line?, list?, message? } when the form is refused
		error: { type: Object, default: null },
		api: { type: Object, required: true },
		// Loads the page again into a new FormState (after an edit conflict)
		reload: { type: Function, default: null },
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
			// Current FormState; replaced by the one of the new revision after a conflict.
			cur: this.state,
			// { html, diff, text, summary } while the preview step is shown
			review: null,
			// The CAPTCHA the wiki asked for, and the answer typed
			captcha: null,
			captchaWord: '',
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
		onDefault() {
			if ( this.review ) {
				this.review = null;
				this.captcha = null;
				this.notice = null;
			} else {
				this.open = false;
			}
		},
		// Validate, then show the preview and diff; the save itself is onSave.
		onReview() {
			if ( this.preview ) {
				return Promise.resolve();
			}
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
					const { text: old, call } = this.cur;
					const text = applyEdits( old, call, changes );
					if ( text === old ) {
						this.notice = { type: 'notice', text: mw.msg( 'wizz-ui-nochange' ) };
						return null;
					}
					const summary = buildSummary( dirty.map( ( f ) => f.param ), this.summaryMsg );
					// Edits stay inside the call, so what follows it is unchanged.
					const callText = text.slice( call.start, text.length - ( old.length - call.end ) );
					mw.loader.load( 'mediawiki.diff.styles' );
					return preview( this.api, this.cur, callText, text ).then( ( p ) => {
						this.review = Object.assign( p, { text, summary } );
						this.notice = null;
					}, ( e ) => {
						this.notice = { type: 'error', text: mw.msg( 'wizz-error-preview', e.message || e ) };
					} );
				} )
				.then( null, ( e ) => {
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
		// Send the reviewed edit; the wiki's answer decides what is shown next.
		onSave() {
			const extra = this.captcha ? { captchaid: this.captcha.id, captchaword: this.captchaWord } : undefined;
			this.saving = true;
			return save( this.api, this.cur, this.review.text, this.review.summary, extra )
				.then( ( saved ) => this.afterSave( saved ) )
				.then( null, ( e ) => {
					const own = /^wizz-/.test( e.code ) && mw.messages.exists( e.code );
					this.notice = { type: 'error', text: own ? mw.msg( e.code, e.line ) : mw.msg( 'wizz-error-save', e.message || e ) };
				} )
				.then( () => {
					this.saving = false;
				} );
		},
		afterSave( saved ) {
			if ( saved.result === 'success' ) {
				const url = new URL( location.href );
				url.searchParams.delete( 'wizz' );
				url.searchParams.delete( 'wizzinstance' );
				location.assign( url );
			} else if ( saved.result === 'nochange' ) {
				this.notice = { type: 'notice', text: mw.msg( 'wizz-ui-nochange' ) };
			} else if ( saved.result === 'warning' ) {
				// Saving again confirms it.
				this.notice = { type: 'warning', text: mw.msg( 'wizz-abusefilter-warning', saved.message ) };
			} else if ( saved.result === 'captcha' ) {
				this.captcha = saved.captcha;
				this.captchaWord = '';
				const usable = saved.captcha.question || saved.captcha.url;
				this.notice = { type: usable ? 'notice' : 'error', text: mw.msg( usable ? 'wizz-captcha-intro' : 'wizz-captcha-unsupported' ) };
				this.$nextTick( () => {
					const input = document.querySelector( '.wizz-captcha input' );
					if ( input ) {
						input.focus();
					}
				} );
			} else {
				// Conflict (FR-006): the new revision, the user's changed values kept.
				return this.reload().then( ( fresh ) => {
					keepDirty( fresh, this.fields );
					this.cur = fresh;
					this.fields = fresh.fields;
					this.review = null;
					this.captcha = null;
					this.notice = { type: 'warning', text: mw.msg( 'wizz-conflict' ) };
					return Promise.all( this.fields.filter( ( f ) => f.dirty ).map( ( f ) => this.validate( f ) ) );
				} );
			}
			return null;
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
		for ( const f of this.fields.filter( ( x ) => x.state === 'ok' && !this.preview ) ) {
			f.warnings = validateField( f, f.value, this.checkOptions() ).warnings;
		}
	}
};
</script>
