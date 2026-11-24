// Form bundle entry. The build wraps this file in `mw.libs.wizz.form = function ( require ) {…}`;
// `vue` and `@wikimedia/codex` come from the `require` the entry gadget passes, so the code
// below runs at top level and exports nothing.
import { createMwApp } from 'vue';
import App from './wizz-App.vue';
import DefinitionCheck from './wizz-DefinitionCheck.vue';
import regexWorker from './wizz-regex-worker.js?raw';
import css from './wizz.less?inline';
import en from './i18n/en.json';
import vi from './i18n/vi.json';
import { loadPage, loadDefinitions, loadSchema } from './wizz-load.js';
import { findCall, buildState } from './wizz-state.js';
import { checkDefinition } from './wizz-definition.js';

const bundles = { en, vi };
const api = new mw.Api();

// Bundle of the language, `en` for anything missing (research R11).
const messages = ( lang ) => Object.assign( {}, en, bundles[ lang ] );

// The definition JSON without what loadDefinitions adds.
const jsonOf = ( d ) => {
	const json = Object.assign( {}, d );
	[ 'template', 'redirects', 'trusted' ].forEach( ( k ) => delete json[ k ] );
	return json;
};

// null when the bucket has no valid schema; checkDefinition reports that.
const schemaOf = ( bucket ) => typeof bucket !== 'string' ? null : loadSchema( api, bucket )
	.catch( ( e ) => {
		if ( e.code !== 'wizz-definition-invalid' ) {
			throw e;
		}
		return null;
	} );

async function load( instance ) {
	const page = await loadPage( api, mw.config.get( 'wgPageName' ) );
	const definitions = await loadDefinitions( api, page.templates );
	// `wizzinstance` only before the user has picked one.
	const wanted = instance === undefined ? parseInt( mw.util.getParamValue( 'wizzinstance' ), 10 ) : instance;
	const { definition: raw, call, calls } = findCall( page, definitions, mw.config.get( 'wgNamespaceIds' ), wanted );
	const schema = await schemaOf( raw.bucket );
	// A field gone from the bucket must not stop the form (read-only, spec edge case).
	const { definition, errors } = checkDefinition( jsonOf( raw ), schema, { tolerateRemoved: true } );
	if ( errors.length ) {
		throw Object.assign( new Error( 'wizz-definition-invalid' ), { code: 'wizz-definition-invalid', list: errors } );
	}
	return buildState( page, definition, schema, call, calls );
}

// FR-029: on Module:<Name>/wizz.json show the check result and a button that opens the form
// with empty values and no way to save.
async function definitionPage( props ) {
	const suffix = '/wizz.json';
	const name = mw.config.get( 'wgTitle' ).slice( 0, -suffix.length );
	const raw = ( await loadDefinitions( api, [ 'Template:' + name ] ) )[ 0 ];
	if ( !raw ) {
		return;
	}
	const json = jsonOf( raw );
	const schema = raw.jsonError ? null : await schemaOf( json.bucket );
	const { definition, errors, warnings } = raw.jsonError ?
		{ errors: [ 'definition: not valid JSON: ' + raw.jsonError ], warnings: [] } :
		checkDefinition( json, schema );
	const holder = document.createElement( 'div' );
	( document.getElementById( 'mw-content-text' ) || document.body ).prepend( holder );
	let preview;
	const onPreview = () => {
		if ( preview ) {
			preview.unmount();
		}
		const page = { title: mw.config.get( 'wgPageName' ), text: '', rights: [] };
		const state = buildState( page, definition, schema, { params: [], index: 0 } );
		preview = createMwApp( App, Object.assign( { state, preview: true }, props ) );
		preview.mount( document.body.appendChild( document.createElement( 'div' ) ) );
	};
	createMwApp( DefinitionCheck, { errors, warnings, trusted: raw.trusted, onPreview } ).mount( holder );
}

( async () => {
	mw.messages.set( messages( mw.config.get( 'wgUserLanguage' ) ) );
	mw.util.addCSS( css );
	// The summary is in the wiki's content language, not the user's.
	const content = messages( mw.config.get( 'wgContentLanguage' ) );
	const summaryMsg = ( key, ...params ) => params.reduce( ( s, p, i ) => s.replace( '$' + ( i + 1 ), p ), content[ key ] );
	const props = { api, summaryMsg, reload: load, regex: { source: regexWorker } };
	if ( mw.config.get( 'wgNamespaceNumber' ) === 828 && mw.config.get( 'wgTitle' ).endsWith( '/wizz.json' ) ) {
		await definitionPage( props );
		return;
	}
	try {
		props.state = await load();
	} catch ( e ) {
		// mw.Api rejects with a code string, our own errors with { code, line, list }.
		props.error = typeof e === 'string' ? { code: e } : { code: e.code, line: e.line, list: e.list, message: e.message };
	}
	const mount = document.body.appendChild( document.createElement( 'div' ) );
	createMwApp( App, props ).mount( mount );
} )();
