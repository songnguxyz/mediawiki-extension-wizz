'use strict';

const { checkDefinition } = require( '../src/wizz-definition.js' );

const schema = { name: 'b', fields: {
	ten: { type: 'TEXT' },
	cao: { type: 'INTEGER' },
	ban: { type: 'PAGE', repeated: true },
	song: { type: 'BOOLEAN' }
} };
const mk = ( fields, bucket = 'b' ) => ( { bucket, fields } );

QUnit.module( 'wizz-definition' );

QUnit.test( 'valid definition: defaults and derived data', ( assert ) => {
	const r = checkDefinition( mk( [
		{ field: 'ten' },
		{ field: 'cao', param: ' chiều cao ', label: 'Cao' },
		{ field: 'ban', separator: ';' }
	] ), schema );
	assert.deepEqual( [ r.errors, r.warnings ], [ [], [] ] );
	const row = ( f ) => [ f.field, f.param, f.label, f.type, f.repeated, f.state ];
	assert.deepEqual( r.definition.fields.map( row ), [
		[ 'ten', 'ten', 'ten', 'TEXT', false, 'ok' ],
		[ 'cao', 'chiều cao', 'Cao', 'INTEGER', false, 'ok' ],
		[ 'ban', 'ban', 'ban', 'PAGE', true, 'ok' ]
	] );
	assert.strictEqual( r.definition.bucket, 'b' );
} );

QUnit.test( 'structure: JSON paths in errors', ( assert ) => {
	const errors = ( json, s = schema ) => checkDefinition( json, s ).errors;
	assert.deepEqual( errors( [] ), [ 'definition: must be an object' ] );
	assert.deepEqual( errors( { fields: [ { field: 'ten' } ] } ), [ 'bucket: required, a non-empty string' ] );
	assert.deepEqual( errors( { bucket: 'b' } ), [ 'fields: required, a non-empty list' ] );
	assert.deepEqual( errors( mk( [] ) ), [ 'fields: required, a non-empty list' ] );
	assert.deepEqual( errors( { bucket: 'b', x: 1, fields: [ { field: 'ten' } ] } ), [ 'x: unknown property' ] );
	assert.deepEqual( errors( mk( [ 'ten' ] ) ), [ 'fields[0]: must be an object' ] );
	assert.deepEqual( errors( mk( [ { field: 'ten', label: 3, nope: 1 } ] ) ),
		[ 'fields[0].label: must be a non-empty string', 'fields[0].nope: unknown property' ] );
	assert.deepEqual( errors( mk( [ { label: 'x' } ] ) ), [ 'fields[0].field: required' ] );
	assert.deepEqual( errors( mk( [ { field: 'Ten' } ] ) ), [ 'fields[0].field: "Ten" must be lowercase letters, digits and _' ] );
	assert.deepEqual( errors( mk( [ { field: 'ten', min: 'a', required: 1, allowed: [] } ] ) ), [
		'fields[0].min: must be a number',
		'fields[0].required: must be true or false',
		'fields[0].allowed: must be a non-empty list of strings'
	] );
	assert.deepEqual( errors( mk( [ { field: 'song', booleanValues: [ 'a' ] } ] ) ),
		[ 'fields[0].booleanValues: must be two strings' ] );
	assert.deepEqual( errors( mk( [ { field: 'ban', separator: ' ' } ] ) ),
		[ 'fields[0].separator: must be a string with a visible character' ] );
} );

QUnit.test( 'bucket without a valid schema is an error', ( assert ) => {
	assert.deepEqual( checkDefinition( mk( [ { field: 'ten' } ] ), null ).errors,
		[ 'bucket: "b" does not exist or is not a valid schema' ] );
} );

QUnit.test( 'duplicate field or param', ( assert ) => {
	const r = checkDefinition( mk( [
		{ field: 'ten' }, { field: 'ten', param: 'x' }, { field: 'cao', param: 'ten' }
	] ), schema );
	assert.deepEqual( r.errors, [
		'fields[1].field: "ten" is already used by fields[0]',
		'fields[2].param: "ten" is already used by fields[0]'
	] );
	assert.deepEqual( checkDefinition( mk( [ { field: 'ten' }, { field: 'cao', param: 'ten', x: 1 } ] ), schema ).errors, [
		'fields[1].x: unknown property',
		'fields[1].param: "ten" is already used by fields[0]'
	], 'also when the entry has another error' );
} );

QUnit.test( 'field not in the bucket: error, or removed state when tolerated', ( assert ) => {
	const json = mk( [ { field: 'ten' }, { field: 'x' }, { field: 'chieu_cao', pattern: 'a' } ] );
	const msg = ( n ) => 'fields[' + n + '].field: "' + json.fields[ n ].field + '" is not a field of bucket "b"';
	const strict = checkDefinition( json, schema );
	assert.deepEqual( strict.errors, [ msg( 1 ), msg( 2 ) ] );
	assert.deepEqual( strict.definition.fields.map( ( f ) => f.state ), [ 'ok', 'removed', 'removed' ] );
	const lax = checkDefinition( json, schema, { tolerateRemoved: true } );
	assert.deepEqual( [ lax.errors, lax.warnings ], [ [], [ msg( 1 ), msg( 2 ) ] ] );
	assert.strictEqual( lax.definition.fields[ 2 ].pattern, undefined, 'no rules for a removed field' );
} );

QUnit.test( 'pattern: compiles with u, at most 500 characters', ( assert ) => {
	const errors = ( p ) => checkDefinition( mk( [ { field: 'ten', pattern: p } ] ), schema ).errors;
	assert.deepEqual( errors( '^a+$' ), [] );
	assert.deepEqual( errors( '(' ), [ 'fields[0].pattern: is not a valid regular expression' ] );
	assert.deepEqual( errors( '\\p{Foo}' ), [ 'fields[0].pattern: is not a valid regular expression' ] );
	assert.deepEqual( errors( 'a'.repeat( 501 ) ), [ 'fields[0].pattern: must be at most 500 characters' ] );
} );

QUnit.test( 'rules that do not fit the type: warning, ignored', ( assert ) => {
	const r = checkDefinition( mk( [
		{ field: 'cao', pattern: 'a', allowed: [ 'a' ], mustExist: true, category: 'C', min: 1 },
		{ field: 'ten', booleanValues: [ 'a', 'b' ], namespaces: [ 0 ], separator: ';' },
		{ field: 'ban', min: 1, pattern: 'a' },
		{ field: 'song', max: 3, allowed: [ 'a' ] }
	] ), schema );
	assert.deepEqual( r.errors, [] );
	assert.deepEqual( r.warnings, [
		'fields[0].pattern: ignored, only for TEXT fields',
		'fields[0].allowed: ignored, only for TEXT or PAGE fields',
		'fields[0].mustExist: ignored, only for PAGE fields',
		'fields[0].category: ignored, only for PAGE fields',
		'fields[1].booleanValues: ignored, only for BOOLEAN fields',
		'fields[1].namespaces: ignored, only for PAGE fields',
		'fields[1].separator: ignored, only for repeated fields',
		'fields[2].min: ignored, not for PAGE or BOOLEAN fields',
		'fields[2].pattern: ignored, only for TEXT fields',
		'fields[3].max: ignored, not for PAGE or BOOLEAN fields',
		'fields[3].allowed: ignored, only for TEXT or PAGE fields'
	] );
	const [ cao, ten ] = r.definition.fields;
	assert.deepEqual( [ cao.min, cao.pattern, cao.allowed, cao.mustExist ], [ 1, undefined, undefined, undefined ] );
	assert.deepEqual( [ ten.booleanValues, ten.namespaces, ten.separator ], [ undefined, undefined, undefined ] );
} );
