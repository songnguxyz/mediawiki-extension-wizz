// Form bundle entry. The build wraps this file in `mw.libs.wizz.form = function ( require ) {…}`;
// `vue` and `@wikimedia/codex` come from the `require` the entry gadget passes, so the code
// below runs at top level and exports nothing.
import { createMwApp } from 'vue';
import App from './wizz-App.vue';
import css from './wizz.less?inline';
import en from './i18n/en.json';
import vi from './i18n/vi.json';
import { loadPage, loadDefinitions, loadSchema } from './wizz-load.js';
import { findCall, buildState } from './wizz-state.js';

const bundles = { en, vi };
const api = new mw.Api();

// Bundle of the language, `en` for anything missing (research R11).
const messages = ( lang ) => Object.assign( {}, en, bundles[ lang ] );

async function load() {
	const page = await loadPage( api, mw.config.get( 'wgPageName' ) );
	const definitions = await loadDefinitions( api, page.templates );
	const { definition, call } = findCall( page, definitions, mw.config.get( 'wgNamespaceIds' ) );
	return buildState( page, definition, await loadSchema( api, definition.bucket ), call );
}

( async () => {
	mw.messages.set( messages( mw.config.get( 'wgUserLanguage' ) ) );
	mw.util.addCSS( css );
	// The summary is in the wiki's content language, not the user's.
	const content = messages( mw.config.get( 'wgContentLanguage' ) );
	const summaryMsg = ( key, ...params ) => params.reduce( ( s, p, i ) => s.replace( '$' + ( i + 1 ), p ), content[ key ] );
	const props = { api, summaryMsg };
	try {
		props.state = await load();
	} catch ( e ) {
		// mw.Api rejects with a code string, our own errors with { code, line }.
		props.error = typeof e === 'string' ? { code: e } : { code: e.code, line: e.line, message: e.message };
	}
	const mount = document.body.appendChild( document.createElement( 'div' ) );
	createMwApp( App, props ).mount( mount );
} )();
