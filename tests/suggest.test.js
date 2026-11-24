'use strict';

const { splitValue, suggestTitles } = require( '../src/wizz-suggest.js' );

// Fake mw.Api: records requests, answers with `response`.
function fakeApi( response ) {
	const calls = [];
	return { calls, get: ( params ) => {
		calls.push( params );
		return Promise.resolve( response );
	} };
}

QUnit.module( 'wizz-suggest' );

QUnit.test( 'splitValue: a single value is all search term, a repeated one searches its last item', ( assert ) => {
	assert.deepEqual( splitValue( { repeated: false }, 'Kim' ), { head: '', term: 'Kim' } );
	assert.deepEqual( splitValue( { repeated: true, rules: { separator: ';' } }, 'Bạch Dương; Kim' ), { head: 'Bạch Dương; ', term: 'Kim' } );
	assert.deepEqual( splitValue( { repeated: true, rules: {} }, 'A,B' ), { head: 'A,', term: 'B' } );
	assert.deepEqual( splitValue( { repeated: true, rules: {} }, 'A, ' ), { head: 'A, ', term: '' } );
} );

QUnit.test( 'no category: prefixsearch limited by namespaces, default [ 0 ]', async ( assert ) => {
	const api = fakeApi( { query: { prefixsearch: [ { title: 'Kim Ngưu' }, { title: 'Kim Sa' } ] } } );
	assert.deepEqual( await suggestTitles( api, { namespaces: [ 0, 10 ] }, 'Kim' ), [ 'Kim Ngưu', 'Kim Sa' ] );
	assert.deepEqual( api.calls[ 0 ], {
		action: 'query', formatversion: 2, list: 'prefixsearch', pssearch: 'Kim', psnamespace: '0|10', pslimit: 10
	} );
	await suggestTitles( api, {}, 'Kim' );
	assert.strictEqual( api.calls[ 1 ].psnamespace, '0' );
} );

QUnit.test( 'category: generator variant, non-members dropped, search order kept', async ( assert ) => {
	const api = fakeApi( { query: { pages: [
		{ title: 'Kim Sa', index: 2, categories: [ { title: 'Category:Nhân vật' } ] },
		{ title: 'Kim Cương', index: 3 },
		{ title: 'Kim Ngưu', index: 1, categories: [ { title: 'Category:Nhân vật' } ] }
	] } } );
	assert.deepEqual( await suggestTitles( api, { category: 'Nhân vật' }, 'Kim' ), [ 'Kim Ngưu', 'Kim Sa' ] );
	assert.deepEqual( api.calls[ 0 ], {
		action: 'query', formatversion: 2, generator: 'prefixsearch', gpssearch: 'Kim', gpsnamespace: '0', gpslimit: 10,
		prop: 'categories', clcategories: 'Category:Nhân vật', cllimit: 'max'
	} );
} );

QUnit.test( 'nothing found, or nothing typed: empty list', async ( assert ) => {
	assert.deepEqual( await suggestTitles( fakeApi( { batchcomplete: true } ), { category: 'X' }, 'Zz' ), [] );
	assert.deepEqual( await suggestTitles( fakeApi( { batchcomplete: true } ), {}, 'Zz' ), [] );
	const api = fakeApi( {} );
	assert.deepEqual( await suggestTitles( api, {}, '  ' ), [] );
	assert.strictEqual( api.calls.length, 0 );
} );
