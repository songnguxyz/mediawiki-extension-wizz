'use strict';

/**
 * Save through action=edit (contracts/api-calls.md request 6). Pure: `api` is an mw.Api-like
 * object with postWithEditToken( params ).
 *
 * @param {Object} api
 * @param {Object} state { page, revid, basetimestamp, starttimestamp, text, assert, canTag }, `text`
 *  being the wikitext the form was built from
 * @param {string} newText Full new page text
 * @param {string} summary
 * @return {Promise<Object>} { result: 'nochange' } or { result: 'success', newrevid }; rejects
 *  with an Error carrying the API error `code`
 */
async function save( api, state, newText, summary ) {
	if ( newText === state.text ) {
		return { result: 'nochange' };
	}
	const params = {
		action: 'edit',
		formatversion: 2,
		title: state.page,
		text: newText,
		baserevid: state.revid,
		basetimestamp: state.basetimestamp,
		starttimestamp: state.starttimestamp,
		nocreate: 1,
		assert: state.assert,
		summary
	};
	if ( state.canTag ) {
		params.tags = 'wizz';
	}
	// mw.Api rejects with ( code, data ), which `await` would reduce to the code.
	const data = await api.postWithEditToken( params ).then( null, ( code, info ) => {
		throw Object.assign( new Error( info && info.error ? info.error.info : code ), { code } );
	} );
	return data.edit.nochange ? { result: 'nochange' } : { result: 'success', newrevid: data.edit.newrevid };
}

// Titles per query for users without apihighlimits.
const TITLES_PER_QUERY = 50;

/**
 * Must-exist check (contracts/api-calls.md request 4): one batched query.
 *
 * @param {Object} api mw.Api-like object with get( params )
 * @param {string[]} titles As typed by the user
 * @return {Promise<Set<string>>} The titles, spelled as given, that do not exist or are invalid
 */
async function findMissing( api, titles ) {
	// A | would split into two titles; it is not a valid title anyway.
	const missing = new Set( titles.filter( ( t ) => t.includes( '|' ) ) );
	const unique = [ ...new Set( titles ) ].filter( ( t ) => !missing.has( t ) );
	for ( let i = 0; i < unique.length; i += TITLES_PER_QUERY ) {
		const chunk = unique.slice( i, i + TITLES_PER_QUERY );
		const { query } = await api.get( { action: 'query', formatversion: 2, titles: chunk.join( '|' ) } );
		const normalized = {};
		for ( const n of query.normalized || [] ) {
			normalized[ n.from ] = n.to;
		}
		const gone = new Set(
			query.pages.filter( ( p ) => p.missing || p.invalid ).map( ( p ) => p.title )
		);
		for ( const t of chunk ) {
			if ( gone.has( normalized[ t ] || t ) ) {
				missing.add( t );
			}
		}
	}
	return missing;
}

module.exports = { save, findMissing };
