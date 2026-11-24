'use strict';

const { buildSummary } = require( '../src/wizz-editor.js' );

// Stand-in for mw.msg: key plus parameters.
const msg = ( key, ...params ) => key + '|' + params.join( '#' );

QUnit.module( 'wizz-editor buildSummary' );

QUnit.test( 'lists the changed parameters in the given order', ( assert ) => {
	assert.strictEqual( buildSummary( [ 'cung', 'chiều cao' ], msg ), 'wizz-summary|cung, chiều cao' );
} );

QUnit.test( 'no change gives no summary', ( assert ) => {
	assert.strictEqual( buildSummary( [], msg ), '' );
} );
