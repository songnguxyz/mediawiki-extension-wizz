'use strict';

/**
 * Field validation (FR-009..FR-016), one module for typing and saving. Pure: no `mw`, DOM or
 * Vue. Type and repeated-ness come from the Bucket schema through the field (Constitution III);
 * rules come from the definition entry, `field.rules`.
 *
 * A field is { type, repeated, dirty, rules }. Problems are { key, params } where `key` is a
 * message key and `params[ 0 ]` is the failing value (the item, for repeated fields).
 */

const REGEX_LIMIT_MS = 200;
const INTEGER = /^[+-]?\d+$/;
const DOUBLE = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
const problem = ( key, ...params ) => ( { key, params } );

/**
 * @param {Object} field
 * @param {string} value
 * @return {string[]} Trimmed non-empty items: the split value of a repeated field, else the value
 */
function itemsOf( field, value ) {
	const text = String( value );
	const parts = field.repeated ? text.split( ( field.rules || {} ).separator || ',' ) : [ text ];
	return parts.map( ( p ) => p.trim() ).filter( Boolean );
}

// Namespace id of a title, 0 when the prefix is not a namespace.
function namespaceOf( title, nsIds ) {
	const m = /^:?\s*([^:]+?)\s*:/.exec( title );
	const key = m && m[ 1 ].toLowerCase().replace( / /g, '_' );
	return key && key in nsIds ? nsIds[ key ] : 0;
}

function itemProblems( field, item, nsIds ) {
	const { type } = field;
	const { min, max, allowed, namespaces = [ 0 ] } = field.rules || {};
	const numeric = type === 'INTEGER' || type === 'DOUBLE';
	if ( numeric && !( type === 'INTEGER' ? INTEGER : DOUBLE ).test( item ) ) {
		return [ problem( type === 'INTEGER' ? 'wizz-error-integer' : 'wizz-error-number', item ) ];
	}
	const out = [];
	if ( numeric || type === 'TEXT' ) {
		const size = numeric ? Number( item ) : Array.from( item ).length;
		const unit = numeric ? 'value' : 'length';
		if ( min !== undefined && size < min ) {
			out.push( problem( 'wizz-error-min-' + unit, item, min ) );
		}
		if ( max !== undefined && size > max ) {
			out.push( problem( 'wizz-error-max-' + unit, item, max ) );
		}
	}
	if ( ( type === 'TEXT' || type === 'PAGE' ) && allowed && !allowed.includes( item ) ) {
		out.push( problem( 'wizz-error-allowed', item ) );
	}
	if ( type === 'PAGE' && !namespaces.includes( namespaceOf( item, nsIds ) ) ) {
		out.push( problem( 'wizz-error-namespace', item ) );
	}
	return out;
}

/**
 * The rules that need no network or Worker: required, type, min, max, allowed, namespaces.
 * A value that was not edited (`field.dirty` false) is never an error (FR-015): the same
 * problems come back as one warning.
 *
 * @param {Object} field
 * @param {string} value
 * @param {Object} [opts] { nsIds } wgNamespaceIds, for PAGE namespaces
 * @return {{errors: Object[], warnings: Object[]}}
 */
function validateField( field, value, opts ) {
	if ( field.type === 'BOOLEAN' ) {
		return { errors: [], warnings: [] };
	}
	const items = itemsOf( field, value );
	const found = ( field.rules || {} ).required && !items.length ? [ problem( 'wizz-error-required' ) ] : [];
	for ( const item of items ) {
		found.push( ...itemProblems( field, item, ( opts && opts.nsIds ) || {} ) );
	}
	if ( !field.dirty ) {
		return { errors: [], warnings: found.length ? [ problem( 'wizz-warning-invalid-existing' ) ] : [] };
	}
	return { errors: found, warnings: [] };
}

/**
 * @param {Object} field
 * @param {string} value
 * @param {Set<string>} missing Titles that do not exist (see findMissing in wizz-save.js)
 * @return {Object[]} Problems for the items of a mustExist PAGE field that are in `missing`
 */
function mustExistErrors( field, value, missing ) {
	if ( field.type !== 'PAGE' || !( field.rules || {} ).mustExist ) {
		return [];
	}
	return itemsOf( field, value ).filter( ( i ) => missing.has( i ) )
		.map( ( i ) => problem( 'wizz-error-mustexist', i ) );
}

// --- FieldDefinition.pattern (research R6) ---

let worker = null;
let queue = Promise.resolve();

// Browser default for `createWorker( source )`: the worker source runs from a Blob URL.
function blobWorker( source ) {
	return new Worker( URL.createObjectURL( new Blob( [ source ], { type: 'text/javascript' } ) ) );
}

// ponytail: shortcut, heuristic, replace if the CSP check passes (R6). Used only when no Worker
// can start: short values and no quantified group followed by another quantifier, e.g. (a+)+.
function runOnMainThread( pattern, value ) {
	if ( value.length > REGEX_LIMIT_MS || /\([^)]*[+*}][^)]*\)[+*{?]/.test( pattern ) ) {
		return { error: 'wizz-error-regex-unavailable' };
	}
	try {
		return { match: new RegExp( pattern, 'u' ).test( value ) };
	} catch ( e ) {
		return { error: 'wizz-error-regex-unavailable' };
	}
}

function stopWorker() {
	if ( worker ) {
		worker.terminate();
		worker = null;
	}
}

/**
 * Test `value` against `pattern` (flag u) in a Worker, one test at a time. After 200 ms the
 * worker is terminated and recreated for the next test.
 *
 * @param {string} pattern
 * @param {string} value
 * @param {Object} regex { source: worker source text, createWorker?: ( source ) => Worker }
 * @return {Promise<Object>} { match } or { error: 'wizz-error-regex-timeout' |
 *  'wizz-error-regex-unavailable' }
 */
function testPattern( pattern, value, regex ) {
	const run = () => new Promise( ( resolve ) => {
		try {
			worker = worker || ( regex.createWorker || blobWorker )( regex.source );
		} catch ( e ) {
			resolve( runOnMainThread( pattern, value ) );
			return;
		}
		const w = worker;
		const timer = setTimeout( () => {
			stopWorker();
			resolve( { error: 'wizz-error-regex-timeout' } );
		}, REGEX_LIMIT_MS );
		w.onmessage = ( e ) => {
			clearTimeout( timer );
			resolve( e.data.invalid ? { error: 'wizz-error-regex-unavailable' } : { match: e.data.match } );
		};
		// The worker could not run at all, e.g. blocked by the CSP after the constructor.
		w.onerror = () => {
			clearTimeout( timer );
			stopWorker();
			resolve( runOnMainThread( pattern, value ) );
		};
		w.postMessage( { pattern, value } );
	} );
	queue = queue.then( run, run );
	return queue;
}

/**
 * @param {Object} field
 * @param {string} value
 * @param {Object} regex See testPattern
 * @return {Promise<Object[]>} At most one problem: the first item that fails the pattern
 */
async function validatePattern( field, value, regex ) {
	const { pattern } = field.rules || {};
	if ( !pattern || field.type !== 'TEXT' ) {
		return [];
	}
	for ( const item of itemsOf( field, value ) ) {
		const r = await testPattern( pattern, item, regex );
		if ( r.error || !r.match ) {
			return [ problem( r.error || 'wizz-error-pattern', item ) ];
		}
	}
	return [];
}

module.exports = {
	validateField, itemsOf, mustExistErrors, testPattern, validatePattern, stopWorker
};
