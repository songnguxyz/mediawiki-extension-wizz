'use strict';

/**
 * Ask a test wiki (core preprocessor) for the parse tree of every round-trip fixture and
 * store it as `<name>.parsetree.xml` next to the fixture. Usage: `npm run fixtures:parsetree`.
 * Waits for the wiki to answer, polling every 30 s for up to 40 minutes.
 */

const fs = require( 'fs' );
const path = require( 'path' );
const { setTimeout: sleep } = require( 'timers/promises' );

const api = process.env.WIZZ_TEST_API || 'http://localhost:8080/api.php';
const dir = path.join( __dirname, '..', 'tests', 'fixtures', 'roundtrip' );

/**
 * @param {string} text
 * @return {Promise<string>} parse tree XML
 */
async function fetchTree( text ) {
	// Node 22 built-in; the lint config still assumes Node 16.
	// eslint-disable-next-line n/no-unsupported-features/node-builtins
	const res = await fetch( api, {
		method: 'POST',
		body: new URLSearchParams( {
			action: 'parse',
			prop: 'parsetree',
			contentmodel: 'wikitext',
			format: 'json',
			formatversion: '2',
			text: text
		} )
	} );
	if ( !res.ok ) {
		throw new Error( 'HTTP ' + res.status );
	}
	const data = await res.json();
	if ( !data.parse || typeof data.parse.parsetree !== 'string' ) {
		throw new Error( 'No parse tree: ' + JSON.stringify( data ).slice( 0, 200 ) );
	}
	return data.parse.parsetree;
}

/**
 * @param {string} text
 * @return {Promise<string>}
 */
async function fetchWithRetry( text ) {
	for ( let attempt = 0; ; attempt++ ) {
		try {
			return await fetchTree( text );
		} catch ( e ) {
			if ( attempt >= 80 ) {
				throw e;
			}
			process.stderr.write( 'Waiting for ' + api + ' (' + e.message + ')\n' );
			await sleep( 30000 );
		}
	}
}

( async () => {
	const files = fs.readdirSync( dir ).filter( ( f ) => f.endsWith( '.wikitext' ) );
	for ( const f of files ) {
		const tree = await fetchWithRetry( fs.readFileSync( path.join( dir, f ), 'utf8' ) );
		fs.writeFileSync( path.join( dir, f.replace( /\.wikitext$/, '.parsetree.xml' ) ), tree );
	}
	process.stdout.write( 'Wrote ' + files.length + ' parse trees from ' + api + '\n' );
} )().catch( ( e ) => {
	process.stderr.write( e.stack + '\n' );
	process.exitCode = 1;
} );
