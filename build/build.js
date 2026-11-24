#!/usr/bin/env node
'use strict';

// npm run build: Vite bundle plus the dist/ files of research R12.
const crypto = require( 'crypto' );
const fs = require( 'fs' );
const path = require( 'path' );

const root = path.join( __dirname, '..' );
const dist = path.join( root, 'dist' );
const { version } = require( '../package.json' );
const ENTRY_LIMIT = 3 * 1024;

const gadgetsDefinition = [
	'* wizz[ResourceLoader|default|package|dependencies=mediawiki.api,mediawiki.util]|wizz.js|wizz-config.json',
	'* wizz-form[ResourceLoader|hidden|package|dependencies=vue,@wikimedia/codex,mediawiki.api,mediawiki.util,mediawiki.jqueryMsg]|wizz-form.js',
	''
].join( '\n' );

const deploy = {
	pages: [
		{ file: 'wizz.js', title: 'MediaWiki:Gadget-wizz.js' },
		{ file: 'wizz-config.json', title: 'MediaWiki:Gadget-wizz-config.json', createOnly: true },
		{ file: 'wizz-form.js', title: 'MediaWiki:Gadget-wizz-form.js' }
	],
	definition: { file: 'gadgets-definition.txt' }
};

async function main() {
	// Vite empties dist/ first, so it runs before anything else is written.
	await require( 'vite' ).build( { root, logLevel: 'warn' } );

	// ResourceLoader's minifier rejects syntax newer than ES2017 (e.g. object spread).
	require( 'acorn' ).parse( fs.readFileSync( path.join( dist, 'wizz-form.js' ), 'utf8' ), { ecmaVersion: 2017 } );

	const entry = fs.readFileSync( path.join( root, 'src/wizz.js' ), 'utf8' );
	if ( !entry.includes( '@@WIZZ_VERSION@@' ) ) {
		throw new Error( 'src/wizz.js has no @@WIZZ_VERSION@@ placeholder' );
	}
	fs.writeFileSync( path.join( dist, 'wizz.js' ), entry.replace( '@@WIZZ_VERSION@@', version ) );
	fs.copyFileSync( path.join( root, 'src/wizz-config.json' ), path.join( dist, 'wizz-config.json' ) );
	fs.writeFileSync( path.join( dist, 'gadgets-definition.txt' ), gadgetsDefinition );
	fs.writeFileSync( path.join( dist, 'deploy.json' ), JSON.stringify( deploy, null, '\t' ) + '\n' );

	const size = [ 'wizz.js', 'wizz-config.json' ]
		.reduce( ( sum, f ) => sum + fs.statSync( path.join( dist, f ) ).size, 0 );
	if ( size > ENTRY_LIMIT ) {
		throw new Error( `wizz.js + wizz-config.json are ${ size } bytes, limit ${ ENTRY_LIMIT }` );
	}

	const sha256 = ( f ) => crypto.createHash( 'sha256' )
		.update( fs.readFileSync( path.join( dist, f ) ) ).digest( 'hex' );
	const sums = fs.readdirSync( dist ).filter( ( f ) => f !== 'SHA256SUMS' ).sort()
		.map( ( f ) => sha256( f ) + '  ' + f );
	fs.writeFileSync( path.join( dist, 'SHA256SUMS' ), sums.join( '\n' ) + '\n' );

	// eslint-disable-next-line no-console
	console.log( `Built wizz ${ version }: entry ${ size } of ${ ENTRY_LIMIT } bytes` );
}

main().catch( ( e ) => {
	// eslint-disable-next-line no-console
	console.error( e.message );
	process.exitCode = 1;
} );
