'use strict';

// Title suggestions of PAGE fields (contracts/api-calls.md request 4). Pure: `api` is an
// mw.Api-like object with get( params ) returning a promise of the formatversion 2 response.

/**
 * @param {Object} field
 * @param {string} value What is typed
 * @return {Object} { head, term }: a repeated field suggests for its last item, `head` is
 *  everything typed before it (kept as typed)
 */
function splitValue( field, value ) {
	const sep = ( field.rules || {} ).separator || ',';
	const i = field.repeated ? value.lastIndexOf( sep ) : -1;
	const term = value.slice( i < 0 ? 0 : i + sep.length ).trimStart();
	return { head: value.slice( 0, value.length - term.length ), term };
}

/**
 * @param {Object} api
 * @param {Object} rules FieldDefinition: `namespaces` (default [ 0 ]) and `category`
 * @param {string} term
 * @return {Promise<string[]>} Up to 10 titles starting with `term`, in search order; with a
 *  category only its members (so often fewer)
 */
async function suggestTitles( api, rules, term ) {
	const search = term.trim();
	if ( !search ) {
		return [];
	}
	const namespaces = ( rules.namespaces || [ 0 ] ).join( '|' );
	if ( !rules.category ) {
		const found = await api.get( {
			action: 'query', formatversion: 2, list: 'prefixsearch',
			pssearch: search, psnamespace: namespaces, pslimit: 10
		} );
		return ( ( found.query || {} ).prefixsearch || [] ).map( ( r ) => r.title );
	}
	const data = await api.get( {
		action: 'query', formatversion: 2, generator: 'prefixsearch',
		gpssearch: search, gpsnamespace: namespaces, gpslimit: 10,
		prop: 'categories', clcategories: 'Category:' + rules.category, cllimit: 'max'
	} );
	return ( ( data.query || {} ).pages || [] ).filter( ( p ) => p.categories )
		.sort( ( a, b ) => a.index - b.index ).map( ( p ) => p.title );
}

module.exports = { splitValue, suggestTitles };
