'use strict';

const { validateField, itemsOf, mustExistErrors } = require( '../src/wizz-validate.js' );

// wgNamespaceIds keys are lowercase with underscores.
const nsIds = JSON.parse( '{ "talk": 1, "category": 14, "help_talk": 13 }' );
const field = ( type, rules, over ) => Object.assign(
	{ type, repeated: false, dirty: true, rules: rules || {} }, over );
const keys = ( r ) => r.errors.map( ( e ) => e.key );

QUnit.module( 'wizz-validate' );

QUnit.test( 'INTEGER and DOUBLE reject text, wikitext and ~150 (FR-011)', ( assert ) => {
	for ( const v of [ 'abc', '~150', '12 cm', '{{x}}', '1.5', '<ref>1</ref>', '1e3', '--1' ] ) {
		assert.deepEqual( keys( validateField( field( 'INTEGER' ), v ) ), [ 'wizz-error-integer' ], v );
	}
	for ( const v of [ 'abc', '~1.5', '1,5', '1.2.3', '{{x}}', '.' ] ) {
		assert.deepEqual( keys( validateField( field( 'DOUBLE' ), v ) ), [ 'wizz-error-number' ], v );
	}
	for ( const v of [ '0', '150', '-3', '+7', ' 42 ', '' ] ) {
		assert.deepEqual( keys( validateField( field( 'INTEGER' ), v ) ), [], v );
	}
	for ( const v of [ '1.5', '-0.25', '.5', '3.', '2e3', '7' ] ) {
		assert.deepEqual( keys( validateField( field( 'DOUBLE' ), v ) ), [], v );
	}
} );

QUnit.test( 'required: non-empty after trimming', ( assert ) => {
	const f = field( 'TEXT', { required: true } );
	assert.deepEqual( keys( validateField( f, '' ) ), [ 'wizz-error-required' ] );
	assert.deepEqual( keys( validateField( f, '  \n ' ) ), [ 'wizz-error-required' ] );
	assert.deepEqual( keys( validateField( f, 'x' ) ), [] );
	assert.deepEqual( keys( validateField( field( 'TEXT', { required: true }, { repeated: true } ), ' , ' ) ), [ 'wizz-error-required' ] );
	assert.deepEqual( keys( validateField( field( 'TEXT' ), '' ) ), [], 'not required: empty is fine' );
} );

QUnit.test( 'min/max: value for numbers, length for TEXT', ( assert ) => {
	const n = field( 'INTEGER', { min: 0, max: 300 } );
	assert.deepEqual( keys( validateField( n, '-1' ) ), [ 'wizz-error-min-value' ] );
	assert.deepEqual( keys( validateField( n, '301' ) ), [ 'wizz-error-max-value' ] );
	assert.deepEqual( keys( validateField( n, '300' ) ), [] );
	assert.deepEqual( validateField( n, '301' ).errors[ 0 ].params, [ '301', 300 ] );
	const d = field( 'DOUBLE', { min: 0.5 } );
	assert.deepEqual( keys( validateField( d, '0.25' ) ), [ 'wizz-error-min-value' ] );
	const t = field( 'TEXT', { min: 2, max: 4 } );
	assert.deepEqual( keys( validateField( t, 'a' ) ), [ 'wizz-error-min-length' ] );
	assert.deepEqual( keys( validateField( t, 'abcde' ) ), [ 'wizz-error-max-length' ] );
	assert.deepEqual( keys( validateField( t, 'abcd' ) ), [] );
	assert.deepEqual( keys( validateField( t, '😀😀😀😀' ) ), [], 'characters, not UTF-16 units' );
	assert.deepEqual( keys( validateField( field( 'PAGE', { max: 1 } ), 'Long title' ) ), [], 'ignored for PAGE' );
	assert.deepEqual( keys( validateField( field( 'TEXT', { min: 5 } ), '' ) ), [], 'empty skips bounds' );
} );

QUnit.test( 'allowed: TEXT and PAGE, exact items', ( assert ) => {
	const f = field( 'TEXT', { allowed: [ 'Bạch Dương', 'Song Ngư' ] } );
	assert.deepEqual( keys( validateField( f, 'Song Ngư' ) ), [] );
	assert.deepEqual( keys( validateField( f, 'Kim Ngưu' ) ), [ 'wizz-error-allowed' ] );
	assert.deepEqual( keys( validateField( field( 'PAGE', { allowed: [ 'A' ] } ), 'B' ) ), [ 'wizz-error-allowed' ] );
	assert.deepEqual( keys( validateField( field( 'INTEGER', { allowed: [ 'A' ] } ), '5' ) ), [], 'ignored for INTEGER' );
} );

QUnit.test( 'namespaces: default [0], PAGE only', ( assert ) => {
	const opts = { nsIds };
	assert.deepEqual( keys( validateField( field( 'PAGE' ), 'Foo', opts ) ), [] );
	assert.deepEqual( keys( validateField( field( 'PAGE' ), 'Category:Foo', opts ) ), [ 'wizz-error-namespace' ] );
	assert.deepEqual( keys( validateField( field( 'PAGE' ), 'Foo: bar', opts ) ), [], 'unknown prefix is main namespace' );
	assert.deepEqual( keys( validateField( field( 'PAGE', { namespaces: [ 0, 14 ] } ), ':Category:Foo', opts ) ), [] );
	assert.deepEqual( keys( validateField( field( 'PAGE', { namespaces: [ 13 ] } ), 'Help talk:X', opts ) ), [] );
	assert.deepEqual( keys( validateField( field( 'PAGE', { namespaces: [ 13 ] } ), 'help_talk:X', opts ) ), [] );
	assert.deepEqual( keys( validateField( field( 'TEXT', { namespaces: [ 14 ] } ), 'Foo', opts ) ), [], 'ignored for TEXT' );
} );

QUnit.test( 'repeated: split on the separator, each item checked, failing item reported (FR-013)', ( assert ) => {
	const f = field( 'INTEGER', { max: 10, separator: ';' }, { repeated: true } );
	assert.deepEqual( itemsOf( f, ' 1 ; 2;; 3 ' ), [ '1', '2', '3' ] );
	assert.deepEqual( keys( validateField( f, '1; 2; 3' ) ), [] );
	const r = validateField( f, '1; x; 99' );
	assert.deepEqual( r.errors.map( ( e ) => [ e.key, e.params[ 0 ] ] ),
		[ [ 'wizz-error-integer', 'x' ], [ 'wizz-error-max-value', '99' ] ] );
	assert.deepEqual( itemsOf( field( 'TEXT', {}, { repeated: true } ), 'a, b' ), [ 'a', 'b' ], 'default separator ","' );
	assert.deepEqual( itemsOf( field( 'TEXT' ), ' a, b ' ), [ 'a, b' ], 'one item when not repeated' );
	assert.deepEqual( itemsOf( field( 'TEXT' ), '  ' ), [] );
} );

QUnit.test( 'untouched invalid value: a warning only, never an error (FR-015)', ( assert ) => {
	const f = field( 'INTEGER', { min: 0 }, { dirty: false } );
	const r = validateField( f, '~150' );
	assert.deepEqual( r.errors, [] );
	assert.deepEqual( r.warnings.map( ( w ) => w.key ), [ 'wizz-warning-invalid-existing' ] );
	assert.deepEqual( validateField( field( 'INTEGER', {}, { dirty: false } ), '150' ), { errors: [], warnings: [] } );
	assert.deepEqual( validateField( field( 'TEXT', { required: true }, { dirty: false } ), '' ).errors, [] );
} );

QUnit.test( 'mustExistErrors: only items in the missing set, only PAGE with mustExist', ( assert ) => {
	const f = field( 'PAGE', { mustExist: true, separator: ';' }, { repeated: true } );
	const e = mustExistErrors( f, 'A; B; C', new Set( [ 'B', 'C' ] ) );
	assert.deepEqual( e.map( ( x ) => [ x.key, x.params[ 0 ] ] ), [ [ 'wizz-error-mustexist', 'B' ], [ 'wizz-error-mustexist', 'C' ] ] );
	assert.deepEqual( mustExistErrors( field( 'PAGE', {} ), 'B', new Set( [ 'B' ] ) ), [] );
	assert.deepEqual( mustExistErrors( field( 'TEXT', { mustExist: true } ), 'B', new Set( [ 'B' ] ) ), [] );
} );
