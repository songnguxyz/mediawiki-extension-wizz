<template>
	<div class="wizz-check">
		<cdx-message v-if="!trusted" type="warning">
			{{ $i18n( 'wizz-definition-untrusted' ).text() }}
		</cdx-message>
		<cdx-message v-if="errors.length" type="error">
			{{ $i18n( 'wizz-definition-invalid' ).text() }}
			<ul>
				<li v-for="e in errors" :key="e">
					{{ e }}
				</li>
			</ul>
		</cdx-message>
		<cdx-message v-else type="success">
			{{ $i18n( 'wizz-definition-valid' ).text() }}
		</cdx-message>
		<cdx-message v-if="warnings.length" type="warning">
			{{ $i18n( 'wizz-definition-warnings' ).text() }}
			<ul>
				<li v-for="w in warnings" :key="w">
					{{ w }}
				</li>
			</ul>
		</cdx-message>
		<cdx-button v-if="!errors.length" @click="$emit( 'preview' )">
			{{ $i18n( 'wizz-ui-preview-form' ).text() }}
		</cdx-button>
	</div>
</template>

<script>
import { CdxButton, CdxMessage } from '@wikimedia/codex';

export default {
	components: { CdxButton, CdxMessage },
	props: {
		errors: { type: Array, required: true },
		warnings: { type: Array, required: true },
		trusted: { type: Boolean, required: true }
	},
	emits: [ 'preview' ]
};
</script>
