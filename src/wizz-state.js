'use strict';

/**
 * Build the in-memory form state (data-model.md FormState) from loaded data. Pure, no `mw`/DOM.
 */

const { parse } = require( './wizz-tokenizer.js' );
const { matchesTemplate } = require( './wizz-editor.js' );

// Values Bucket casts to true; the definition's own true text is added per field.
const TRUE_VALUES = [ '1', 'true', 'on', 'yes' ];

// Value of the last parameter of that name (MediaWiki semantics), '' if absent.
const valueOf = ( call, name ) => call.params.filter( ( p ) => p.name === name ).map( ( p ) => p.value ).pop() || '';

/**
 * @param {Object} page Result of loadPage
 * @param {Object[]} definitions Result of loadDefinitions
 * @param {Object} nsIds wgNamespaceIds
 * @param {number} [wanted] Instance index (`wizzinstance`)
 * @return {Object} { definition, call, calls } for the first template with a definition. `calls`
 *  are all its calls, `index` recounted across redirects, with `summary`. `call` is the wanted
 *  one, the only one if there is just one, else null (the user must choose). The definition is
 *  still unchecked (see wizz-definition.js)
 * @throws {{code: string}} wizz-noinfobox; wizz-parseerror with `line`; wizz-definition-untrusted;
 *  wizz-definition-invalid with `list` when the definition page is not JSON
 */
function findCall( page, definitions, nsIds, wanted ) {
	const all = parse( page.text ).calls;
	for ( const call of all ) {
		const definition = definitions.find(
			( d ) => matchesTemplate( call.nameText, d.template, d.redirects, nsIds )
		);
		if ( definition && !definition.trusted ) {
			// FR-028: an untrusted definition is not even read.
			throw Object.assign( new Error( 'wizz-definition-untrusted' ), { code: 'wizz-definition-untrusted' } );
		}
		if ( definition && definition.jsonError ) {
			throw Object.assign( new Error( 'wizz-definition-invalid' ), {
				code: 'wizz-definition-invalid',
				list: [ 'definition: not valid JSON: ' + definition.jsonError ]
			} );
		}
		if ( definition ) {
			const calls = all.filter(
				( c ) => matchesTemplate( c.nameText, definition.template, definition.redirects, nsIds )
			);
			calls.forEach( ( c, i ) => {
				c.index = i;
				c.summary = definition.fields.slice( 0, 2 )
					.map( ( f ) => valueOf( c, f.param || f.field ) ).filter( Boolean ).join( ', ' );
			} );
			return { definition, calls, call: calls[ wanted ] || ( calls.length === 1 ? calls[ 0 ] : null ) };
		}
	}
	throw Object.assign( new Error( 'wizz-noinfobox' ), { code: 'wizz-noinfobox' } );
}

/**
 * @param {Object} page Result of loadPage
 * @param {Object} definition Chosen definition
 * @param {Object} schema Bucket schema
 * @param {Object|null} call TemplateCall; null while the user still has to choose an instance
 * @param {Object[]} [calls] All calls of the template (findCall)
 * @return {Object} FormState, plus `text` and `call` (what the save needs)
 */
function buildState( page, definition, schema, call, calls ) {
	const fields = !call ? [] : definition.fields.map( ( f ) => {
		const param = f.param || f.field;
		// A field gone from the schema is read-only with a warning, its value never rewritten.
		const known = schema.fields[ f.field ];
		const { type = 'TEXT', repeated = false } = known || {};
		const found = call.params.filter( ( p ) => p.name === param );
		let value = found.length ? found[ found.length - 1 ].value : '';
		const booleanValues = f.booleanValues || [ 'yes', 'no' ];
		if ( type === 'BOOLEAN' ) {
			value = [ booleanValues[ 0 ].toLowerCase() ].concat( TRUE_VALUES )
				.includes( value.toLowerCase() );
		}
		return {
			field: f.field,
			param,
			label: f.label || param,
			help: f.help,
			type,
			repeated,
			booleanValues,
			value,
			initial: value,
			dirty: false,
			rules: f,
			state: known ? 'ok' : 'removed',
			errors: [],
			warnings: known ? [] : [ { key: 'wizz-definition-removed', params: [] } ]
		};
	} );
	return {
		page: page.title,
		revid: page.revid,
		basetimestamp: page.timestamp,
		starttimestamp: page.starttimestamp,
		text: page.text,
		call,
		instances: calls && calls.length > 1 ? calls.map( ( c ) => ( { index: c.index, summary: c.summary } ) ) : [],
		instance: call ? call.index : null,
		fields,
		assert: page.anon ? 'anon' : 'user',
		canTag: page.tagActive && page.rights.includes( 'applychangetags' )
	};
}

/**
 * After an edit conflict (FR-006): move the values the user changed onto the state built from
 * the new revision.
 *
 * @param {Object} fresh FormState of the new revision, changed in place
 * @param {Object[]} fields The fields of the form the user was typing in
 */
function keepDirty( fresh, fields ) {
	for ( const old of fields.filter( ( f ) => f.dirty ) ) {
		const f = fresh.fields.find( ( x ) => x.param === old.param );
		if ( f && f.state === 'ok' ) {
			f.value = old.value;
			f.dirty = f.value !== f.initial;
		}
	}
}

module.exports = { findCall, buildState, keepDirty };
