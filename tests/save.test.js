'use strict';

const { save, findMissing } = require( '../src/wizz-save.js' );

const state = ( over ) => Object.assign( {
	page: 'Song Ngư (nhân vật)',
	revid: 7,
	basetimestamp: '2026-11-24T09:00:00Z',
	starttimestamp: '2026-11-24T10:00:00Z',
	text: 'old',
	assert: 'user',
	canTag: false
}, over );

// Fake mw.Api: records posts, answers with `response`.
function fakeApi( response ) {
	const posts = [];
	return {
		posts,
		postWithEditToken: ( params ) => {
			posts.push( params );
			return Promise.resolve( response );
		}
	};
}

QUnit.module( 'wizz-save' );

QUnit.test( 'identical text: nochange and no API call', async ( assert ) => {
	const api = fakeApi( {} );
	assert.deepEqual( await save( api, state(), 'old', 's' ), { result: 'nochange' } );
	assert.strictEqual( api.posts.length, 0 );
} );

QUnit.test( 'sends the edit with the revision base and returns newrevid', async ( assert ) => {
	const api = fakeApi( { edit: { result: 'Success', newrevid: 8 } } );
	assert.deepEqual( await save( api, state(), 'new', 'Edit infobox: cung' ), { result: 'success', newrevid: 8 } );
	assert.deepEqual( api.posts[ 0 ], {
		action: 'edit',
		formatversion: 2,
		title: 'Song Ngư (nhân vật)',
		text: 'new',
		baserevid: 7,
		basetimestamp: '2026-11-24T09:00:00Z',
		starttimestamp: '2026-11-24T10:00:00Z',
		nocreate: 1,
		assert: 'user',
		summary: 'Edit infobox: cung'
	} );
} );

QUnit.test( 'tag wizz only when canTag', async ( assert ) => {
	const api = fakeApi( { edit: { result: 'Success', newrevid: 8 } } );
	await save( api, state(), 'new', 's' );
	await save( api, state( { canTag: true } ), 'new', 's' );
	assert.false( 'tags' in api.posts[ 0 ] );
	assert.strictEqual( api.posts[ 1 ].tags, 'wizz' );
} );

QUnit.test( 'server-side nochange', async ( assert ) => {
	const api = fakeApi( { edit: { result: 'Success', nochange: true } } );
	assert.deepEqual( await save( api, state(), 'new', 's' ), { result: 'nochange' } );
} );

QUnit.test( 'API error rejects with its code and info', async ( assert ) => {
	const api = { postWithEditToken: () => ( { then: ( ok, fail ) => Promise.resolve( fail( 'protectedpage', { error: { info: 'Protected' } } ) ) } ) };
	await assert.rejects( save( api, state(), 'new', 's' ), ( e ) => e.code === 'protectedpage' && e.message === 'Protected' );
} );

QUnit.module( 'wizz-save findMissing' );

QUnit.test( 'one batched query; missing titles come back by input spelling; a | is missing without asking', async ( assert ) => {
	const calls = [];
	const api = { get: ( p ) => {
		calls.push( p );
		return Promise.resolve( { query: {
			normalized: [ { from: 'bạch dương', to: 'Bạch dương' } ],
			pages: [ { title: 'Bạch dương', missing: true }, { title: 'Kim Ngưu', pageid: 3 } ]
		} } );
	} };
	const missing = await findMissing( api, [ 'bạch dương', 'Kim Ngưu', 'bạch dương', 'a|b' ] );
	assert.deepEqual( [ ...missing ].sort(), [ 'a|b', 'bạch dương' ] );
	assert.strictEqual( calls.length, 1 );
	assert.deepEqual( calls[ 0 ], { action: 'query', formatversion: 2, titles: 'bạch dương|Kim Ngưu' } );
} );

QUnit.test( 'no titles: no API call', async ( assert ) => {
	const api = { get: () => assert.true( false, 'called' ) };
	assert.strictEqual( ( await findMissing( api, [] ) ).size, 0 );
} );
