'use strict';

const { findCall, buildState, keepDirty } = require( '../src/wizz-state.js' );

const page = ( text, over ) => Object.assign( {
	title: 'P', revid: 7, timestamp: 'T1', starttimestamp: 'T2', text,
	templates: [], rights: [ 'edit', 'applychangetags' ], tagActive: true
}, over );
const def = {
	template: 'Template:Infobox x', redirects: [ 'Template:IX' ], trusted: true, bucket: 'b',
	fields: [
		{ field: 'ten' },
		{ field: 'cao', param: 'chiều cao', label: 'Cao', help: 'cm' },
		{ field: 'song', param: 'còn sống', booleanValues: [ 'có', 'không' ] },
		{ field: 'moi' }
	]
};
const schema = { fields: {
	ten: { type: 'TEXT' },
	cao: { type: 'INTEGER' },
	song: { type: 'BOOLEAN' },
	moi: { type: 'TEXT', repeated: true }
} };
const nsIds = { template: 10 };

const build = ( p, defs ) => {
	const { definition, call } = findCall( p, defs || [ def ], nsIds );
	return buildState( p, definition, schema, call );
};

QUnit.module( 'wizz-state' );

QUnit.test( 'builds fields from the first matching call', ( assert ) => {
	const text = 'x {{IX|ten = A <ref>r</ref>|chiều cao=~150|còn sống = có}} ' +
		'{{Infobox x|ten=B}}';
	const s = build( page( text ) );
	assert.deepEqual( [ s.page, s.revid, s.basetimestamp, s.starttimestamp, s.canTag, s.instance ],
		[ 'P', 7, 'T1', 'T2', true, 0 ] );
	const row = ( f ) => [ f.param, f.label, f.help, f.type, f.repeated, f.value, f.dirty ];
	assert.deepEqual( s.fields.map( row ), [
		[ 'ten', 'ten', undefined, 'TEXT', false, 'A <ref>r</ref>', false ],
		[ 'chiều cao', 'Cao', 'cm', 'INTEGER', false, '~150', false ],
		[ 'còn sống', 'còn sống', undefined, 'BOOLEAN', false, true, false ],
		[ 'moi', 'moi', undefined, 'TEXT', true, '', false ]
	] );
} );

QUnit.test( 'no matching call: wizz-noinfobox', ( assert ) => {
	assert.throws( () => build( page( '{{Other}}' ) ), ( e ) => e.code === 'wizz-noinfobox' );
} );

QUnit.test( 'matching definition that is untrusted or not JSON is refused', ( assert ) => {
	assert.throws( () => build( page( '{{IX}}' ), [ Object.assign( {}, def, { trusted: false } ) ] ),
		( e ) => e.code === 'wizz-definition-untrusted' );
	const bad = { template: def.template, redirects: [], trusted: true, jsonError: 'Unexpected token' };
	assert.throws( () => build( page( '{{Infobox x}}' ), [ bad ] ),
		( e ) => e.code === 'wizz-definition-invalid' && e.list.length === 1 && e.list[ 0 ].includes( 'Unexpected token' ) );
	assert.throws( () => build( page( '{{Infobox x}}' ), [ Object.assign( {}, bad, { trusted: false } ) ] ),
		( e ) => e.code === 'wizz-definition-untrusted', 'untrusted is not even parsed' );
} );

QUnit.test( 'field missing from the schema: removed, read-only warning, value kept', ( assert ) => {
	const d = Object.assign( {}, def, { fields: [ { field: 'ten' }, { field: 'gone', param: 'cũ' } ] } );
	const { definition, call } = findCall( page( '{{IX|ten=a|cũ=old}}' ), [ d ], nsIds );
	const s = buildState( page( '{{IX|ten=a|cũ=old}}' ), definition, schema, call );
	assert.deepEqual( s.fields.map( ( f ) => [ f.state, f.value, f.warnings.map( ( w ) => w.key ) ] ), [
		[ 'ok', 'a', [] ],
		[ 'removed', 'old', [ 'wizz-definition-removed' ] ]
	] );
} );

QUnit.test( 'malformed call: wizz-parseerror with line', ( assert ) => {
	assert.throws( () => build( page( 'a\n{{IX|ten=1' ) ), ( e ) => e.code === 'wizz-parseerror' && e.line === 2 );
} );

QUnit.test( 'assert follows the loaded user', ( assert ) => {
	assert.strictEqual( build( page( '{{IX}}' ) ).assert, 'user' );
	assert.strictEqual( build( page( '{{IX}}', { anon: true } ) ).assert, 'anon' );
} );

QUnit.test( 'canTag needs the tag active and the right', ( assert ) => {
	assert.false( build( page( '{{IX}}', { tagActive: false } ) ).canTag );
	assert.false( build( page( '{{IX}}', { rights: [ 'edit' ] } ) ).canTag );
} );

QUnit.test( 'keepDirty: changed values move to the new revision, others take its values (FR-006)', ( assert ) => {
	const mine = build( page( '{{IX|ten=a|chiều cao=1|moi=x}}' ) );
	mine.fields.find( ( f ) => f.field === 'ten' ).value = 'mine';
	mine.fields.find( ( f ) => f.field === 'ten' ).dirty = true;
	mine.fields.find( ( f ) => f.field === 'cao' ).value = '9';
	mine.fields.find( ( f ) => f.field === 'cao' ).dirty = true;
	const fresh = build( page( '{{IX|ten=theirs|chiều cao=9|moi=y}}', { revid: 8 } ) );
	keepDirty( fresh, mine.fields );
	const get = ( n ) => fresh.fields.find( ( f ) => f.field === n );
	assert.deepEqual( [ get( 'ten' ).value, get( 'ten' ).dirty ], [ 'mine', true ] );
	// Someone else made the same change: nothing left to save for that field.
	assert.deepEqual( [ get( 'cao' ).value, get( 'cao' ).dirty ], [ '9', false ] );
	assert.deepEqual( [ get( 'moi' ).value, get( 'moi' ).dirty ], [ 'y', false ] );
} );
