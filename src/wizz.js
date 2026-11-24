// Wizz entry gadget: tiny, runs on every page view; loads the form only on ?wizz=1.
( function () {
	const version = '@@WIZZ_VERSION@@'; // replaced by build/build.js
	const config = require( './wizz-config.json' );
	const formDependencies = [ 'vue', '@wikimedia/codex', 'mediawiki.api', 'mediawiki.util', 'mediawiki.jqueryMsg' ];

	mw.libs.wizz = { version };

	if (
		mw.config.get( 'wgAction' ) !== 'view' ||
		mw.config.get( 'wgRevisionId' ) !== mw.config.get( 'wgCurRevisionId' ) ||
		!config.namespaces.includes( mw.config.get( 'wgNamespaceNumber' ) ) ||
		new URLSearchParams( location.search ).get( 'wizz' ) !== '1'
	) {
		return;
	}

	let loaded;
	if ( config.cdn === true ) {
		const url = 'https://cdn.jsdelivr.net/gh/songnguxyz/mediawiki-extension-wizz@v' +
			version + '/dist/wizz-form.js';
		loaded = mw.loader.using( formDependencies )
			.then( ( req ) => mw.loader.getScript( url ).then( () => req ) );
	} else {
		loaded = mw.loader.using( 'ext.gadget.wizz-form' );
	}
	loaded.then( ( req ) => mw.libs.wizz.form( req ) ).catch( ( e ) => mw.log.error( e ) );
}() );
