'use strict';

/**
 * Build the in-memory form state (data-model.md FormState) from loaded data. Pure, no `mw`/DOM.
 */

const { parse } = require( './wizz-tokenizer.js' );
const { matchesTemplate } = require( './wizz-editor.js' );

// Values Bucket casts to true; the definition's own true text is added per field.
const TRUE_VALUES = [ '1', 'true', 'on', 'yes' ];

/**
 * @param {Object} page Result of loadPage
 * @param {Object[]} definitions Result of loadDefinitions
 * @param {Object} nsIds wgNamespaceIds
 * @return {Object} { definition, call } of the first call (by position) of a trusted template
 * @throws {{code: string}} wizz-noinfobox; wizz-parseerror with `line`
 */
function findCall( page, definitions, nsIds ) {
	// ponytail: first call only; the instance picker (US5) chooses among several.
	const usable = definitions.filter( ( d ) => d.trusted && !d.jsonError );
	for ( const call of parse( page.text ).calls ) {
		const definition = usable.find(
			( d ) => matchesTemplate( call.nameText, d.template, d.redirects, nsIds )
		);
		if ( definition ) {
			return { definition, call };
		}
	}
	throw Object.assign( new Error( 'wizz-noinfobox' ), { code: 'wizz-noinfobox' } );
}

/**
 * @param {Object} page Result of loadPage
 * @param {Object} definition Chosen definition
 * @param {Object} schema Bucket schema
 * @param {Object} call TemplateCall
 * @return {Object} FormState, plus `text` and `call` (what the save needs)
 */
function buildState( page, definition, schema, call ) {
	const fields = definition.fields.map( ( f ) => {
		const param = f.param || f.field;
		const { type = 'TEXT', repeated = false } = schema.fields[ f.field ] || {};
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
			dirty: false
		};
	} );
	return {
		page: page.title,
		revid: page.revid,
		basetimestamp: page.timestamp,
		starttimestamp: page.starttimestamp,
		text: page.text,
		call,
		instance: call.index,
		fields,
		canTag: page.tagActive && page.rights.includes( 'applychangetags' )
	};
}

module.exports = { findCall, buildState };
