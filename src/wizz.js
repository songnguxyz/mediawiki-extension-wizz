// Wizz entry gadget: tiny, runs on every page view; adds the edit tab, loads the form only on ?wizz=1.
( function () {
	const version = '@@WIZZ_VERSION@@'; // replaced by build/build.js
	const config = require( './wizz-config.json' );
	const formDependencies = [ 'vue', '@wikimedia/codex', 'mediawiki.api', 'mediawiki.util', 'mediawiki.jqueryMsg' ];

	mw.libs.wizz = { version };

	// FR-023: the tab only on a page that calls a template with a definition (api-calls 2).
	function addTab() {
		const api = new mw.Api();
		const get = ( params ) => api.get( Object.assign( { action: 'query', formatversion: 2 }, params ) );
		get( { titles: mw.config.get( 'wgPageName' ), prop: 'templates', tlnamespace: 10, tllimit: 'max' } )
			.then( ( data ) => {
				const chunks = [];
				const titles = ( data.query.pages[ 0 ].templates || [] )
					.map( ( t ) => 'Module:' + t.title.slice( t.title.indexOf( ':' ) + 1 ) + '/wizz.json' );
				while ( titles.length ) {
					chunks.push( get( { titles: titles.splice( 0, 50 ).join( '|' ) } ) );
				}
				return Promise.all( chunks );
			} )
			.then( ( found ) => {
				if ( found.some( ( r ) => r.query.pages.some( ( p ) => p.pageid ) ) ) {
					// The on-wiki config may lack keys (it is never overwritten): defaults of the contract.
					const labels = Object.assign( { en: 'Edit infobox', vi: 'Sửa infobox' }, config.tabLabel );
					mw.util.addPortletLink(
						mw.config.get( 'skin' ) === 'minerva' ? 'page-actions-overflow' : 'p-views',
						mw.util.getUrl( mw.config.get( 'wgPageName' ), { wizz: 1 } ),
						labels[ mw.config.get( 'wgUserLanguage' ) ] || labels.en,
						'ca-wizz'
					);
				}
			} )
			.catch( ( e ) => mw.log.error( e ) );
	}

	// A definition page (Module:*/wizz.json) always loads the form bundle, in any config.
	const ns = mw.config.get( 'wgNamespaceNumber' );
	const definitionPage = ns === 828 && mw.config.get( 'wgTitle' ).endsWith( '/wizz.json' );
	if (
		mw.config.get( 'wgAction' ) !== 'view' ||
		mw.config.get( 'wgRevisionId' ) !== mw.config.get( 'wgCurRevisionId' ) ||
		!( definitionPage || config.namespaces.includes( ns ) )
	) {
		return;
	}
	if ( !definitionPage && new URLSearchParams( location.search ).get( 'wizz' ) !== '1' ) {
		if ( config.editTab !== false && mw.config.get( 'wgArticleId' ) ) {
			addTab();
		}
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
