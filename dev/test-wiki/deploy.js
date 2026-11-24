#!/usr/bin/env node
/* eslint-disable no-console */
// Upload dist/ to the test wiki as listed in dist/deploy.json (Litmus format:
// pages[{file,title,createOnly?}]; definition.file -> MediaWiki:Gadgets-definition, overwritten).
// Env: WIZZ_TEST_API, WIZZ_TEST_USER (Admin@wizz), WIZZ_TEST_PASS. Usage: node deploy.js [distDir]
'use strict';

const fs = require( 'fs' );
const path = require( 'path' );

const { WIZZ_TEST_API: api, WIZZ_TEST_USER: user, WIZZ_TEST_PASS: pass } = process.env;
if ( !api || !user || !pass ) {
	throw new Error( 'Set WIZZ_TEST_API, WIZZ_TEST_USER and WIZZ_TEST_PASS (see setup.sh output)' );
}
const dist = process.argv[ 2 ] || path.join( __dirname, '../../dist' );
const models = { '.js': 'javascript', '.json': 'json', '.css': 'css' };
const jar = {};

async function call( params, post ) {
	const body = new URLSearchParams( { format: 'json', ...params } );
	// eslint-disable-next-line n/no-unsupported-features/node-builtins
	const res = await fetch( post ? api : api + '?' + body, {
		method: post ? 'POST' : 'GET',
		body: post ? body : undefined,
		headers: { cookie: Object.entries( jar ).map( ( [ k, v ] ) => k + '=' + v ).join( '; ' ) },
		redirect: 'manual'
	} );
	for ( const c of res.headers.getSetCookie() ) {
		const [ k, v ] = c.split( ';' )[ 0 ].split( /=(.*)/s );
		jar[ k ] = v;
	}
	const json = await res.json();
	if ( json.error ) {
		throw new Error( JSON.stringify( json.error ) );
	}
	return json;
}

( async () => {
	const lt = ( await call( { action: 'query', meta: 'tokens', type: 'login' } ) ).query.tokens.logintoken;
	const login = ( await call( { action: 'login', lgname: user, lgpassword: pass, lgtoken: lt }, true ) ).login;
	if ( login.result !== 'Success' ) {
		throw new Error( 'Login failed: ' + login.reason );
	}
	const token = ( await call( { action: 'query', meta: 'tokens' } ) ).query.tokens.csrftoken;

	const manifest = JSON.parse( fs.readFileSync( path.join( dist, 'deploy.json' ), 'utf8' ) );
	const pages = [ ...manifest.pages, { file: manifest.definition.file, title: 'MediaWiki:Gadgets-definition' } ];
	for ( const { file, title, createOnly } of pages ) {
		const p = { action: 'edit', title, token, summary: 'Wizz deploy',
			text: fs.readFileSync( path.join( dist, file ), 'utf8' ) };
		const model = models[ path.extname( file ) ];
		if ( model ) {
			p.contentmodel = model;
		}
		if ( createOnly ) {
			p.createonly = 1;
		}
		try {
			const r = ( await call( p, true ) ).edit;
			console.log( title, r.nochange !== undefined ? 'unchanged' : 'saved' );
		} catch ( e ) {
			if ( !createOnly || !e.message.includes( 'articleexists' ) ) {
				throw e;
			}
		}
	}
} )().catch( ( e ) => {
	console.error( e.message );
	process.exitCode = 1;
} );
