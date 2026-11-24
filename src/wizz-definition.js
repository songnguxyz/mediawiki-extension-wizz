'use strict';

/**
 * Check a form definition (data-model.md FormDefinition, FieldDefinition; contracts/
 * form-definition.schema.json) against the Bucket schema. Pure: no `mw`, DOM or Vue.
 * Problems are strings that start with the JSON path, e.g. `fields[2].field: "x" is not …`.
 */

const PATTERN_LIMIT = 500;
const isObject = ( v ) => v !== null && typeof v === 'object' && !Array.isArray( v );
const isText = ( v ) => typeof v === 'string' && v.trim() !== '';
const isList = ( v, test ) => Array.isArray( v ) && v.length > 0 && v.every( test );

// Property → [ is it well formed, what to say if not ].
const PROPERTIES = {
	field: [ ( v ) => typeof v === 'string' && /^[a-z0-9]+(_[a-z0-9]+)*$/.test( v ), 'must be lowercase letters, digits and _' ],
	param: [ isText, 'must be a non-empty string' ],
	label: [ isText, 'must be a non-empty string' ],
	help: [ ( v ) => typeof v === 'string', 'must be a string' ],
	required: [ ( v ) => typeof v === 'boolean', 'must be true or false' ],
	min: [ Number.isFinite, 'must be a number' ],
	max: [ Number.isFinite, 'must be a number' ],
	pattern: [ isText, 'must be a non-empty string' ],
	allowed: [ ( v ) => isList( v, ( s ) => typeof s === 'string' ), 'must be a non-empty list of strings' ],
	namespaces: [ ( v ) => isList( v, Number.isInteger ), 'must be a non-empty list of integers' ],
	mustExist: [ ( v ) => typeof v === 'boolean', 'must be true or false' ],
	category: [ isText, 'must be a non-empty string' ],
	separator: [ ( v ) => typeof v === 'string' && /\S/.test( v ), 'must be a string with a visible character' ],
	booleanValues: [ ( v ) => Array.isArray( v ) && v.length === 2 && v.every( ( s ) => typeof s === 'string' ), 'must be two strings' ]
};

// Property → [ does it fit the field, what to say if not ].
const TYPES = ( ...t ) => ( f ) => t.includes( f.type );
const FIT = {
	min: [ ( f ) => f.type !== 'PAGE' && f.type !== 'BOOLEAN', 'not for PAGE or BOOLEAN fields' ],
	pattern: [ TYPES( 'TEXT' ), 'only for TEXT fields' ],
	allowed: [ TYPES( 'TEXT', 'PAGE' ), 'only for TEXT or PAGE fields' ],
	namespaces: [ TYPES( 'PAGE' ), 'only for PAGE fields' ],
	mustExist: [ TYPES( 'PAGE' ), 'only for PAGE fields' ],
	category: [ TYPES( 'PAGE' ), 'only for PAGE fields' ],
	separator: [ ( f ) => f.repeated, 'only for repeated fields' ],
	booleanValues: [ TYPES( 'BOOLEAN' ), 'only for BOOLEAN fields' ]
};
FIT.max = FIT.min;

function patternProblem( p ) {
	if ( p.length > PATTERN_LIMIT ) {
		return 'must be at most ' + PATTERN_LIMIT + ' characters';
	}
	try {
		// eslint-disable-next-line no-new
		new RegExp( p, 'u' );
	} catch ( e ) {
		return 'is not a valid regular expression';
	}
	return null;
}

// Checks one entry; returns the normalised field, or null when it has no usable `field`.
function checkField( raw, path, schema, bucket, errors, warnings, tolerateRemoved ) {
	if ( !isObject( raw ) ) {
		errors.push( path + ': must be an object' );
		return null;
	}
	const start = errors.length;
	if ( !( 'field' in raw ) ) {
		errors.push( path + '.field: required' );
	}
	for ( const [ key, value ] of Object.entries( raw ) ) {
		const [ valid, message ] = PROPERTIES[ key ] || [];
		if ( !valid ) {
			errors.push( path + '.' + key + ': unknown property' );
		} else if ( !valid( value ) ) {
			errors.push( path + '.' + key + ': ' + ( key === 'field' ? JSON.stringify( value ) + ' ' : '' ) + message );
		} else if ( key === 'pattern' && patternProblem( value ) ) {
			errors.push( path + '.pattern: ' + patternProblem( value ) );
		}
	}
	if ( typeof raw.field !== 'string' ) {
		return null;
	}
	const known = schema && schema.fields[ raw.field ];
	const param = ( isText( raw.param ) ? raw.param : raw.field ).trim();
	const out = { field: raw.field, param, label: raw.label || param, help: raw.help };
	// Malformed entries are still returned, for the duplicate check; the errors stop the form.
	if ( !schema || errors.length > start ) {
		return out;
	}
	if ( !known ) {
		( tolerateRemoved ? warnings : errors ).push(
			path + '.field: "' + raw.field + '" is not a field of bucket "' + bucket + '"' );
		return Object.assign( out, { state: 'removed' } );
	}
	Object.assign( out, { type: known.type, repeated: !!known.repeated, state: 'ok' } );
	for ( const [ key, value ] of Object.entries( raw ) ) {
		const [ fits, message ] = FIT[ key ] || [];
		if ( fits && !fits( out ) ) {
			warnings.push( path + '.' + key + ': ignored, ' + message );
		} else if ( !( key in out ) ) {
			out[ key ] = value;
		}
	}
	return out;
}

/**
 * @param {*} json Parsed definition page
 * @param {Object|null} schema { fields: { <name>: { type, repeated } } }, null when the bucket
 *  has no valid schema
 * @param {Object} [options] `tolerateRemoved`: a field missing from the schema is a warning,
 *  not an error (the form still opens, the field is read-only: spec edge case on schema changes)
 * @return {{definition: Object, errors: string[], warnings: string[]}} `definition` is the
 *  normalised one (defaults filled in, derived `type`, `repeated`, `state`, ignored rules
 *  dropped); only use it when `errors` is empty.
 */
function checkDefinition( json, schema, options = {} ) {
	const errors = [];
	const warnings = [];
	if ( !isObject( json ) ) {
		return { definition: null, errors: [ 'definition: must be an object' ], warnings };
	}
	for ( const key of Object.keys( json ) ) {
		if ( key !== 'bucket' && key !== 'fields' ) {
			errors.push( key + ': unknown property' );
		}
	}
	const { bucket } = json;
	if ( !isText( bucket ) ) {
		errors.push( 'bucket: required, a non-empty string' );
	} else if ( !schema ) {
		errors.push( 'bucket: "' + bucket + '" does not exist or is not a valid schema' );
	}
	if ( !isList( json.fields, () => true ) ) {
		errors.push( 'fields: required, a non-empty list' );
		return { definition: null, errors, warnings };
	}
	const seen = { field: Object.create( null ), param: Object.create( null ) };
	const fields = json.fields.map( ( raw, i ) => {
		const f = checkField( raw, 'fields[' + i + ']', schema, bucket, errors, warnings, options.tolerateRemoved );
		for ( const key of [ 'field', 'param' ] ) {
			if ( f && f[ key ] in seen[ key ] ) {
				errors.push( 'fields[' + i + '].' + key + ': "' + f[ key ] + '" is already used by fields[' + seen[ key ][ f[ key ] ] + ']' );
			} else if ( f ) {
				seen[ key ][ f[ key ] ] = i;
			}
		}
		return f;
	} );
	return { definition: { bucket, fields }, errors, warnings };
}

module.exports = { checkDefinition };
