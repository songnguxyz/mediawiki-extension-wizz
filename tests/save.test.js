'use strict';

const { save, preview, findMissing } = require( '../src/wizz-save.js' );

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

// Fake mw.Api that rejects like mw.Api: ( code, data ).
const failing = ( code, info ) => ( { postWithEditToken: () => ( { then: ( ok, fail ) => Promise.resolve( fail( code, { error: { info } } ) ) } ) } );

QUnit.test( 'editconflict resolves as conflict', async ( assert ) => {
	assert.deepEqual( await save( failing( 'editconflict', 'Edit conflict' ), state(), 'new', 's' ), { result: 'conflict' } );
} );

QUnit.test( 'abusefilter-warning resolves as warning with its text; sending again is a plain save', async ( assert ) => {
	assert.deepEqual( await save( failing( 'abusefilter-warning', 'Please check' ), state(), 'new', 's' ), { result: 'warning', message: 'Please check' } );
	const api = fakeApi( { edit: { result: 'Success', newrevid: 9 } } );
	assert.strictEqual( ( await save( api, state(), 'new', 's' ) ).newrevid, 9 );
} );

QUnit.test( 'edit.captcha resolves as captcha; resend carries captchaid and captchaword', async ( assert ) => {
	const captcha = { type: 'question', mime: 'text/html', id: '123', question: 'What is 2 + 2?' };
	const api = fakeApi( { edit: { result: 'Failure', captcha } } );
	assert.deepEqual( await save( api, state(), 'new', 's' ), { result: 'captcha', captcha } );
	const ok = fakeApi( { edit: { result: 'Success', newrevid: 9 } } );
	await save( ok, state(), 'new', 's', { captchaid: '123', captchaword: '4' } );
	assert.strictEqual( ok.posts[ 0 ].captchaid, '123' );
	assert.strictEqual( ok.posts[ 0 ].captchaword, '4' );
	await save( ok, state(), 'new', 's' );
	assert.false( 'captchaid' in ok.posts[ 1 ] );
} );

QUnit.test( 'other errors (blocked, abusefilter-disallowed, ratelimited) reject with the API message', async ( assert ) => {
	for ( const code of [ 'blocked', 'abusefilter-disallowed', 'ratelimited', 'spamblacklist' ] ) {
		await assert.rejects( save( failing( code, 'msg ' + code ), state(), 'new', 's' ), ( e ) => e.code === code && e.message === 'msg ' + code );
	}
} );

QUnit.module( 'wizz-save preview' );

QUnit.test( 'parse and compare are sent together and their HTML returned', async ( assert ) => {
	const posts = [];
	const api = { post: ( p ) => {
		posts.push( p );
		return Promise.resolve( p.action === 'parse' ? { parse: { text: '<table>box</table>' } } : { compare: { body: '<tr>diff</tr>' } } );
	} };
	const res = await preview( api, state(), '{{T|a=1}}', 'new full' );
	assert.deepEqual( res, { html: '<table>box</table>', diff: '<tr>diff</tr>' } );
	assert.deepEqual( posts[ 0 ], {
		action: 'parse', formatversion: 2, title: 'Song Ngư (nhân vật)', text: '{{T|a=1}}', pst: 1,
		prop: 'text', disablelimitreport: 1, contentmodel: 'wikitext'
	} );
	assert.deepEqual( posts[ 1 ], {
		action: 'compare', formatversion: 2, fromrev: 7, toslots: 'main', 'totext-main': 'new full',
		'tocontentmodel-main': 'wikitext', prop: 'diff'
	} );
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
