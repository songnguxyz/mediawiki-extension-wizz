'use strict';

const fs = require( 'fs' );
const path = require( 'path' );
const QUnit = require( 'qunit' );
const tokenizer = require( '../src/wizz-tokenizer.js' );
const editor = require( '../src/wizz-editor.js' );

const dir = path.join( __dirname, 'fixtures', 'roundtrip' );
const names = fs.readdirSync( dir )
	.filter( ( f ) => f.endsWith( '.wikitext' ) )
	.map( ( f ) => f.slice( 0, -'.wikitext'.length ) );
const read = ( name, ext ) => fs.readFileSync( path.join( dir, name + ext ), 'utf8' );

/**
 * @param {string} text
 * @param {Object} changes
 * @param {number} [n]
 * @return {string}
 */
function edit( text, changes, n ) {
	return editor.applyEdits( text, tokenizer.parse( text ).calls[ n || 0 ], changes );
}

QUnit.module( 'wizz-editor' );

for ( const name of names ) {
	const text = read( name, '.wikitext' );
	const spec = JSON.parse( read( name, '.edits.json' ) );
	if ( spec.parseError ) {
		continue;
	}
	QUnit.test( name + ': no changes is byte-identical', ( assert ) => {
		for ( const call of tokenizer.parse( text ).calls ) {
			assert.strictEqual( editor.applyEdits( text, call, {} ), text );
		}
	} );
	QUnit.test( name + ': edit gives the expected text', ( assert ) => {
		const call = tokenizer.parse( text ).calls[ spec.call ];
		assert.strictEqual( editor.applyEdits( text, call, spec.changes ), spec.expected );
	} );
}

QUnit.test( 'R4: whitespace around the value is kept', ( assert ) => {
	assert.strictEqual( edit( '{{T\n|  a =  old  \n}}', { a: 'new' } ), '{{T\n|  a =  new  \n}}' );
} );

QUnit.test( 'R4: new parameter copies the layout of the last parameter', ( assert ) => {
	assert.strictEqual( edit( '{{T|a=1}}', { b: '2' } ), '{{T|a=1|b=2}}' );
	assert.strictEqual( edit( '{{T\n| a = 1\n}}', { b: '2' } ), '{{T\n| a = 1\n| b = 2\n}}' );
	assert.strictEqual( edit( '{{T|a = 1 }}', { b: '2' } ), '{{T|a = 1 |b = 2 }}' );
	assert.strictEqual( edit( '{{T\n| a = 1 <!-- c -->\n}}', { b: '2' } ), '{{T\n| a = 1 <!-- c -->\n| b = 2\n}}' );
} );

QUnit.test( 'R4: empty value for an absent parameter adds nothing', ( assert ) => {
	assert.strictEqual( edit( '{{T|a=1}}', { b: '' } ), '{{T|a=1}}' );
} );

QUnit.test( 'R4: cleared field keeps the parameter', ( assert ) => {
	assert.strictEqual( edit( '{{T|a=1|b=2}}', { a: '' } ), '{{T|a=|b=2}}' );
} );

QUnit.test( 'R4: last duplicate is edited', ( assert ) => {
	assert.strictEqual( edit( '{{T|a=1|a=2}}', { a: '3' } ), '{{T|a=1|a=3}}' );
} );

QUnit.test( 'R4: positional parameters are untouched', ( assert ) => {
	assert.strictEqual( edit( '{{T|x|a=1}}', { a: '2' } ), '{{T|x|a=2}}' );
	assert.strictEqual( edit( '{{T|x}}', { 1: '2' } ), '{{T|x|1=2}}' );
} );

QUnit.test( 'unsafe values are refused instead of corrupting the call', ( assert ) => {
	for ( const v of [ 'a|b', 'a}}b', '{{x' ] ) {
		assert.throws( () => edit( '{{T|a=1}}', { a: v } ), ( e ) => /^wizz-/.test( e.code ), v );
	}
	assert.strictEqual( edit( '{{T|a=1}}', { a: '[[x|y]] {{z|1}}' } ), '{{T|a=[[x|y]] {{z|1}}}}' );
} );

QUnit.test( 'matchesTemplate', ( assert ) => {
	const ns = { template: 10, project: 4 };
	ns[ 'bản_mẫu' ] = 10;
	const m = ( name, redirects ) => editor.matchesTemplate( name, 'Template:Infobox person', redirects || [], ns );
	assert.true( m( 'Infobox person' ) );
	assert.true( m( 'infobox person' ), 'first letter case' );
	assert.true( m( ' Infobox_person\n' ), 'underscore and whitespace' );
	assert.true( m( 'Template:Infobox person' ) );
	assert.true( m( 'template : infobox_person' ), 'namespace prefix' );
	assert.true( m( 'Bản mẫu:Infobox person' ), 'localised alias' );
	assert.true( m( 'Infobox<!-- x --> person' ), 'comment in name' );
	assert.true( m( 'Hồ sơ', [ 'Template:Hồ sơ' ] ), 'redirect' );
	assert.true( m( 'đồ', [ 'Template:Đồ' ] ), 'redirect, diacritic first letter' );
	assert.false( m( 'Infobox place' ) );
	assert.false( m( 'Project:Infobox person' ), 'other namespace' );
	assert.false( m( '#if:Infobox person' ) );
	assert.false( m( 'subst:Infobox person' ) );
	assert.false( m( 'SAFESUBST:Infobox person' ) );
	assert.false( m( ':Infobox person' ) );
	assert.false( m( 'Hồ sơ' ), 'redirect not given' );
} );
