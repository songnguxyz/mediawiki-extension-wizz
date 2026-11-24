'use strict';

/**
 * Apply parameter changes to one template call without touching anything else, and decide
 * whether a call name refers to a template. Pure, no `mw`/DOM.
 */

const { parse, trimParts, normalizeName } = require( './wizz-tokenizer.js' );

const noComments = ( s ) => s.replace( /<!--[\s\S]*?-->/g, '' );

/**
 * Whitespace before the parameter name, between name and `=`, and after `=`, plus the
 * whitespace after the value, copied from an existing parameter.
 *
 * @param {string} text
 * @param {Object} p TemplateParam
 * @return {string[]} [ beforeName, beforeEq, afterEq, trail ]
 */
function layout( text, p ) {
	const [ lead, , trail ] = trimParts( p.rawValue );
	// Whitespace up to the first newline after the value is not part of the next line.
	const trailWs = noComments( trail ).replace( /^[^\n]*?(\r?\n)/, '$1' );
	if ( !p.nameSpan ) {
		return [ noComments( lead ), '', '', trailWs ];
	}
	let s = p.nameSpan[ 0 ];
	while ( /\s/.test( text[ s - 1 ] ) ) {
		s--;
	}
	return [
		text.slice( s, p.nameSpan[ 0 ] ),
		noComments( text.slice( p.nameSpan[ 1 ], p.valueSpan[ 0 ] - 1 ) ),
		noComments( lead ),
		trailWs
	];
}

/**
 * Set parameter values of a call, changing only the value spans that differ.
 *
 * Changed parameters keep the whitespace and comments around their value (the last
 * duplicate is edited), new ones are appended before `}}` in the layout of the last
 * parameter, an empty value keeps the parameter. Positional parameters are never touched.
 *
 * @param {string} text Wikitext the call was parsed from
 * @param {Object} call TemplateCall from the tokenizer
 * @param {Object} changes Parameter name to new value
 * @return {string} New wikitext
 * @throws {{code: string}} wizz-unsafevalue if a value would not survive as that parameter's
 *  value (e.g. an unescaped `|`); wizz-parseerror if it unbalances the markup
 */
function applyEdits( text, call, changes ) {
	const edits = [];
	let append = '';
	let appended = 0;
	let last = null;
	for ( const name of Object.keys( changes ) ) {
		const value = changes[ name ];
		const found = call.params.filter( ( x ) => x.name === name );
		const p = found[ found.length - 1 ];
		if ( p ) {
			if ( p.value === value ) {
				continue;
			}
			const [ lead, , trail ] = trimParts( p.rawValue );
			if ( p.value === '' ) {
				// No value yet: whitespace before the first newline stays before the new value.
				const nl = p.rawValue.search( /\r?\n/ );
				const at = p.valueSpan[ 0 ] + ( nl === -1 ? p.rawValue.length : nl );
				const pad = at === p.valueSpan[ 0 ] && text[ at - 2 ] === ' ' ? ' ' : '';
				edits.push( [ at, at, pad + value ] );
			} else {
				// Clearing `| a = x\n` leaves `| a =\n`, not a trailing space.
				const drop = value === '' && !lead.includes( '<!--' ) && trail.includes( '\n' );
				const from = p.valueSpan[ 0 ] + ( drop ? 0 : lead.length );
				edits.push( [ from, p.valueSpan[ 1 ] - trail.length, value ] );
			}
		} else if ( value !== '' ) {
			const lastParam = call.params[ call.params.length - 1 ];
			last = last || ( lastParam ? layout( text, lastParam ) : [ '', '', '', '' ] );
			append += '|' + last[ 0 ] + name + last[ 1 ] + '=' + last[ 2 ] + value + last[ 3 ];
			appended++;
		}
	}
	if ( append ) {
		edits.push( [ call.end - 2, call.end - 2, append ] );
	}
	let out = text;
	for ( const [ from, to, s ] of edits.sort( ( a, b ) => b[ 0 ] - a[ 0 ] ) ) {
		out = out.slice( 0, from ) + s + out.slice( to );
	}
	if ( !edits.length ) {
		return out;
	}
	const after = parse( out ).calls.find( ( c ) => c.start === call.start );
	const ok = after && after.params.length === call.params.length + appended &&
		Object.keys( changes ).every( ( name ) => {
			const found = after.params.filter( ( x ) => x.name === name );
			const got = found[ found.length - 1 ];
			return !got || got.value === trimParts( changes[ name ] )[ 1 ];
		} );
	if ( !ok ) {
		throw Object.assign( new Error( 'wizz-unsafevalue' ), { code: 'wizz-unsafevalue' } );
	}
	return out;
}

/**
 * Whether a template call name refers to the given template or one of its redirects.
 * Names starting with `#`, `subst:`, `safesubst:` or `:` never match.
 *
 * @param {string} nameText Name as written in the call
 * @param {string} templateTitle Title of the template, e.g. `Template:Infobox person`
 * @param {string[]} redirects Titles of redirects to the template
 * @param {Object} nsIds Namespace name or alias (lowercase, `_` for spaces) to id
 * @return {boolean}
 */
function matchesTemplate( nameText, templateTitle, redirects, nsIds ) {
	if ( /^\s*(#|subst:|safesubst:|:)/i.test( nameText ) ) {
		return false;
	}
	const n = normalizeName( nameText, nsIds );
	return [ templateTitle ].concat( redirects ).some( ( t ) => normalizeName( t, nsIds ) === n );
}

/**
 * Edit summary for the changed parameters (FR-007).
 *
 * @param {string[]} changedParams Parameter names, in display order
 * @param {Function} msg Message function like mw.msg: ( key, ...params ) => string
 * @return {string} Empty when nothing changed
 */
function buildSummary( changedParams, msg ) {
	return changedParams.length ? msg( 'wizz-summary', changedParams.join( ', ' ) ) : '';
}

module.exports = { applyEdits, matchesTemplate, buildSummary };
