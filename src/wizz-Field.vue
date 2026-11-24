<template>
	<cdx-field
		class="wizz-field"
	>
		<cdx-checkbox
			v-if="field.type === 'BOOLEAN'"
			:model-value="field.value"
			@update:model-value="$emit( 'update:modelValue', $event )"
		>
			{{ field.label }}
		</cdx-checkbox>
		<cdx-lookup
			v-else-if="field.type === 'PAGE'"
			v-model:selected="selected"
			:input-value="field.value"
			:menu-items="items"
			dir="auto"
			:status="status"
			:disabled="field.state === 'removed'"
			:aria-invalid="status === 'error' ? 'true' : undefined"
			@update:input-value="$emit( 'update:modelValue', $event )"
			@input="onSearch"
			@blur="$emit( 'blur' )"
		></cdx-lookup>
		<cdx-text-area
			v-else-if="multiline"
			:model-value="field.value"
			dir="auto"
			:status="status"
			:disabled="field.state === 'removed'"
			:aria-invalid="status === 'error' ? 'true' : undefined"
			@update:model-value="$emit( 'update:modelValue', $event )"
			@blur="$emit( 'blur' )"
		></cdx-text-area>
		<cdx-text-input
			v-else
			:model-value="field.value"
			:inputmode="field.type === 'INTEGER' || field.type === 'DOUBLE' ? 'decimal' : undefined"
			dir="auto"
			:status="status"
			:disabled="field.state === 'removed'"
			:aria-invalid="status === 'error' ? 'true' : undefined"
			@update:model-value="$emit( 'update:modelValue', $event )"
			@blur="$emit( 'blur' )"
		></cdx-text-input>
		<!-- Not CdxField's `messages`: no id on it, and Codex inputs overwrite an attribute
			described-by; `describe` points the input at this one. -->
		<cdx-message
			v-if="problem"
			:id="errId"
			class="wizz-field__message"
			:type="problem.type"
			:inline="true"
		>
			{{ message }}
		</cdx-message>
		<template v-if="field.type !== 'BOOLEAN'" #label>
			{{ field.label }}
		</template>
		<template v-if="field.help" #help>
			{{ field.help }}
		</template>
	</cdx-field>
</template>

<script>
import { CdxCheckbox, CdxField, CdxLookup, CdxMessage, CdxTextArea, CdxTextInput } from '@wikimedia/codex';
import { splitValue, suggestTitles } from './wizz-suggest.js';

// A value with markup or line breaks needs room.
const MARKUP = /[\n<[{]/;
let uid = 0;

export default {
	components: { CdxCheckbox, CdxField, CdxLookup, CdxMessage, CdxTextArea, CdxTextInput },
	props: {
		field: { type: Object, required: true },
		// Only PAGE fields search titles
		api: { type: Object, default: null }
	},
	emits: [ 'update:modelValue', 'blur' ],
	data() {
		return { items: [], selected: null, searches: 0, errId: 'wizz-msg-' + ( ++uid ) };
	},
	computed: {
		// An error wins over a warning; only the first problem is shown.
		problem() {
			const { errors, warnings } = this.field;
			return errors[ 0 ] ? { type: 'error', p: errors[ 0 ] } :
				warnings[ 0 ] ? { type: 'warning', p: warnings[ 0 ] } : null;
		},
		status() {
			return this.problem ? this.problem.type : 'default';
		},
		message() {
			const { p } = this.problem;
			return mw.msg( p.key, ...p.params );
		},
		multiline() {
			return typeof this.field.initial === 'string' && MARKUP.test( this.field.initial );
		}
	},
	methods: {
		// After the DOM is patched: name the message (or nothing) as the input's description.
		describe() {
			this.$nextTick( () => {
				const input = this.$el.querySelector( 'input, textarea' );
				if ( this.problem ) {
					input.setAttribute( 'aria-describedby', this.errId );
				} else {
					input.removeAttribute( 'aria-describedby' );
				}
			} );
		},
		// Typed by the user (not a pick, which also changes the input): suggest titles. The
		// latest search wins; a failed one just shows no suggestions.
		onSearch( text ) {
			const n = ++this.searches;
			const { head, term } = splitValue( this.field, text );
			suggestTitles( this.api, this.field.rules, term ).catch( () => [] ).then( ( titles ) => {
				if ( n === this.searches ) {
					this.items = titles.map( ( t ) => ( { value: head + t } ) );
				}
			} );
		}
	},
	watch: {
		problem: { handler: 'describe', immediate: true }
	}
};
</script>
