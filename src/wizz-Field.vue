<template>
	<cdx-field
		class="wizz-field"
		:status="status"
		:messages="messages"
	>
		<cdx-checkbox
			v-if="field.type === 'BOOLEAN'"
			:model-value="field.value"
			@update:model-value="$emit( 'update:modelValue', $event )"
		>
			{{ field.label }}
		</cdx-checkbox>
		<cdx-text-area
			v-else-if="multiline"
			:model-value="field.value"
			:status="status"
			:aria-invalid="status === 'error' ? 'true' : undefined"
			@update:model-value="$emit( 'update:modelValue', $event )"
			@blur="$emit( 'blur' )"
		></cdx-text-area>
		<cdx-text-input
			v-else
			:model-value="field.value"
			:inputmode="field.type === 'INTEGER' || field.type === 'DOUBLE' ? 'decimal' : undefined"
			:status="status"
			:aria-invalid="status === 'error' ? 'true' : undefined"
			@update:model-value="$emit( 'update:modelValue', $event )"
			@blur="$emit( 'blur' )"
		></cdx-text-input>
		<template v-if="field.type !== 'BOOLEAN'" #label>
			{{ field.label }}
		</template>
		<template v-if="field.help" #help>
			{{ field.help }}
		</template>
	</cdx-field>
</template>

<script>
import { CdxCheckbox, CdxField, CdxTextArea, CdxTextInput } from '@wikimedia/codex';

// A value with markup or line breaks needs room.
const MARKUP = /[\n<[{]/;

export default {
	components: { CdxCheckbox, CdxField, CdxTextArea, CdxTextInput },
	props: { field: { type: Object, required: true } },
	emits: [ 'update:modelValue', 'blur' ],
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
		messages() {
			const { type, p } = this.problem || {};
			return p ? { [ type ]: mw.msg( p.key, ...p.params ) } : {};
		},
		multiline() {
			return typeof this.field.initial === 'string' && MARKUP.test( this.field.initial );
		}
	}
};
</script>
