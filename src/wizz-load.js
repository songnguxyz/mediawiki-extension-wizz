'use strict';

// API loaders (contracts/api-calls.md requests 1-3). Pure: `api` is an mw.Api-like object
// with get( params ) returning a promise of the formatversion 2 response.

const SUFFIX = '/wizz.json';
// Titles per query for users without apihighlimits; two titles per template.
const TEMPLATES_PER_QUERY = 25;

function fail( code, detail ) {
	return Object.assign( new Error( detail || code ), { code } );
}

// Name without namespace prefix, whatever the localised prefix is.
function baseName( title ) {
	return title.slice( title.indexOf( ':' ) + 1 );
}

function mainContent( page ) {
	return page.revisions[ 0 ].slots.main.content;
}

async function loadPage( api, title ) {
	const data = await api.get( {
		action: 'query',
		formatversion: 2,
		titles: title,
		prop: 'revisions|info|templates',
		intestactions: 'edit',
		rvprop: 'ids|timestamp|content',
		rvslots: 'main',
		tllimit: 'max',
		tlnamespace: 10,
		curtimestamp: 1,
		meta: 'userinfo',
		uiprop: 'rights',
		list: 'tags',
		tgprop: 'active',
		tglimit: 'max'
	} );
	const page = data.query.pages[ 0 ];
	if ( !page.actions.edit ) {
		throw fail( 'wizz-noeditright' );
	}
	const rev = page.revisions[ 0 ];
	return {
		title: page.title,
		revid: rev.revid,
		timestamp: rev.timestamp,
		starttimestamp: data.curtimestamp,
		text: rev.slots.main.content,
		templates: ( page.templates || [] ).map( ( t ) => t.title ),
		rights: data.query.userinfo.rights,
		tagActive: data.query.tags.some( ( t ) => t.name === 'wizz' && t.active )
	};
}

// FR-028: edit protection at sysop level, direct or cascading.
function isTrusted( page ) {
	return ( page.protection || [] ).some( ( p ) => p.type === 'edit' && p.level === 'sysop' );
}

// templates: titles like 'Template:Infobox X'. Returns the existing definitions as
// { ...definition JSON, template, redirects, trusted }, or { template, redirects, trusted,
// jsonError } when the page is not valid JSON.
async function loadDefinitions( api, templates ) {
	const chunks = [];
	for ( let i = 0; i < templates.length; i += TEMPLATES_PER_QUERY ) {
		chunks.push( templates.slice( i, i + TEMPLATES_PER_QUERY ) );
	}
	const responses = await Promise.all( chunks.map( ( chunk ) => api.get( {
		action: 'query',
		formatversion: 2,
		titles: chunk.flatMap( ( t ) => [ 'Module:' + baseName( t ) + SUFFIX, t ] ).join( '|' ),
		prop: 'revisions|info|redirects',
		rvprop: 'content',
		rvslots: 'main',
		inprop: 'protection',
		rdlimit: 'max',
		rdnamespace: 10
	} ) ) );
	const pages = responses.flatMap( ( r ) => r.query.pages );
	const redirects = {};
	for ( const p of pages ) {
		if ( !p.title.endsWith( SUFFIX ) ) {
			redirects[ baseName( p.title ) ] = ( p.redirects || [] ).map( ( r ) => r.title );
		}
	}
	return pages.filter( ( p ) => p.title.endsWith( SUFFIX ) && !p.missing ).map( ( p ) => {
		const name = baseName( p.title ).slice( 0, -SUFFIX.length );
		const meta = { template: 'Template:' + name, redirects: redirects[ name ] || [], trusted: isTrusted( p ) };
		try {
			return Object.assign( JSON.parse( mainContent( p ) ), meta );
		} catch ( e ) {
			return Object.assign( meta, { jsonError: e.message } );
		}
	} );
}

// Returns { name, fields: { <field>: { type, index, repeated } } } (data-model.md BucketSchema).
async function loadSchema( api, bucket ) {
	const data = await api.get( {
		action: 'query',
		formatversion: 2,
		titles: 'Bucket:' + bucket,
		prop: 'revisions',
		rvprop: 'content',
		rvslots: 'main'
	} );
	const page = data.query.pages[ 0 ];
	if ( page.missing ) {
		throw fail( 'wizz-definition-invalid', 'Bucket:' + bucket + ' does not exist' );
	}
	let raw;
	try {
		raw = JSON.parse( mainContent( page ) );
	} catch ( e ) {
		throw fail( 'wizz-definition-invalid', 'Bucket:' + bucket + ': ' + e.message );
	}
	const fields = {};
	for ( const [ name, f ] of Object.entries( raw ) ) {
		fields[ name ] = { type: f.type, index: f.index !== false, repeated: f.repeated === true };
	}
	return { name: bucket, fields };
}

module.exports = { loadPage, loadDefinitions, loadSchema };
