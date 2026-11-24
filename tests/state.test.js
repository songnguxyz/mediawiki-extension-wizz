'use strict';

const { findCall, buildState } = require( '../src/wizz-state.js' );

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

QUnit.test( 'no matching call or untrusted definition: wizz-noinfobox', ( assert ) => {
	assert.throws( () => build( page( '{{Other}}' ) ), ( e ) => e.code === 'wizz-noinfobox' );
	assert.throws( () => build( page( '{{IX}}' ), [ Object.assign( {}, def, { trusted: false } ) ] ),
		( e ) => e.code === 'wizz-noinfobox' );
} );

QUnit.test( 'malformed call: wizz-parseerror with line', ( assert ) => {
	assert.throws( () => build( page( 'a\n{{IX|ten=1' ) ), ( e ) => e.code === 'wizz-parseerror' && e.line === 2 );
} );

QUnit.test( 'canTag needs the tag active and the right', ( assert ) => {
	assert.false( build( page( '{{IX}}', { tagActive: false } ) ).canTag );
	assert.false( build( page( '{{IX}}', { rights: [ 'edit' ] } ) ).canTag );
} );
