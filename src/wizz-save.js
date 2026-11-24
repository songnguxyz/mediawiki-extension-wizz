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

module.exports = { save };
