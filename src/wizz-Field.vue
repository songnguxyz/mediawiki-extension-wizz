<template>
	<cdx-field class="wizz-field">
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
			@update:model-value="$emit( 'update:modelValue', $event )"
		></cdx-text-area>
		<cdx-text-input
			v-else
			:model-value="field.value"
			:inputmode="field.type === 'INTEGER' || field.type === 'DOUBLE' ? 'decimal' : undefined"
			@update:model-value="$emit( 'update:modelValue', $event )"
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
	emits: [ 'update:modelValue' ],
	computed: {
		multiline() {
			return typeof this.field.initial === 'string' && MARKUP.test( this.field.initial );
		}
	}
};
</script>
