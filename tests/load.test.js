'use strict';

const { loadPage, loadDefinitions, loadSchema } = require( '../src/wizz-load.js' );

// Fake mw.Api: records requests, answers from recorded formatversion=2 responses.
function fakeApi( answer ) {
	const requests = [];
	return {
		requests,
		get: ( params ) => {
			requests.push( params );
			return Promise.resolve( answer( params ) );
		}
	};
}

const pageResponse = ( { canEdit = true, tags = [ { name: 'wizz', active: true } ] } = {} ) => ( {
	curtimestamp: '2026-11-24T10:00:00Z',
	query: {
		pages: [ {
			title: 'Song Ngư (nhân vật)',
			actions: { edit: canEdit },
			revisions: [ { revid: 7, timestamp: '2026-11-24T09:00:00Z', slots: { main: { content: '{{Infobox nhân vật|a=1}}' } } } ],
			templates: [ { ns: 10, title: 'Template:Infobox nhân vật' }, { ns: 10, title: 'Template:Khác' } ]
		} ],
		userinfo: { rights: [ 'edit', 'applychangetags' ] },
		tags
	}
} );

const defPage = ( name, content, protection ) => ( {
	title: 'Module:' + name + '/wizz.json',
	protection,
	revisions: [ { slots: { main: { content } } } ]
} );

const defsResponse = ( protection ) => ( {
	query: {
		pages: [
			defPage( 'Infobox nhân vật', '{"bucket":"nhan_vat","fields":[{"field":"ten"}]}', protection ),
			{ title: 'Module:Khác/wizz.json', missing: true },
			{ title: 'Template:Infobox nhân vật', redirects: [ { title: 'Template:IB' } ] },
			{ title: 'Template:Khác' }
		]
	}
} );

QUnit.module( 'wizz-load', () => {
	QUnit.test( 'loadPage returns the revision data', async ( assert ) => {
		const api = fakeApi( () => pageResponse() );
		const page = await loadPage( api, 'Song Ngư (nhân vật)' );
		assert.deepEqual( page, {
			title: 'Song Ngư (nhân vật)',
			revid: 7,
			timestamp: '2026-11-24T09:00:00Z',
			starttimestamp: '2026-11-24T10:00:00Z',
			text: '{{Infobox nhân vật|a=1}}',
			templates: [ 'Template:Infobox nhân vật', 'Template:Khác' ],
			rights: [ 'edit', 'applychangetags' ],
			tagActive: true
		} );
		assert.strictEqual( api.requests[ 0 ].formatversion, 2 );
		assert.strictEqual( api.requests[ 0 ].intestactions, 'edit' );
	} );

	QUnit.test( 'inactive or absent wizz tag', async ( assert ) => {
		const page = await loadPage( fakeApi( () => pageResponse( { tags: [ { name: 'wizz', active: false } ] } ) ), 'X' );
		assert.false( page.tagActive );
	} );

	QUnit.test( 'user cannot edit: wizz-noeditright', async ( assert ) => {
		const api = fakeApi( () => pageResponse( { canEdit: false } ) );
		await assert.rejects( loadPage( api, 'X' ), ( e ) => e.code === 'wizz-noeditright' );
	} );

	QUnit.test( 'definitions: sysop protection direct and cascading is trusted', async ( assert ) => {
		const direct = [ { type: 'edit', level: 'sysop' } ];
		const cascade = [ { type: 'edit', level: 'sysop', source: 'Page' } ];
		for ( const protection of [ direct, cascade ] ) {
			const defs = await loadDefinitions( fakeApi( () => defsResponse( protection ) ), [ 'Template:Infobox nhân vật', 'Template:Khác' ] );
			assert.strictEqual( defs.length, 1, 'only existing definitions are kept' );
			assert.true( defs[ 0 ].trusted );
			assert.strictEqual( defs[ 0 ].template, 'Template:Infobox nhân vật' );
			assert.strictEqual( defs[ 0 ].bucket, 'nhan_vat' );
			assert.deepEqual( defs[ 0 ].redirects, [ 'Template:IB' ] );
		}
	} );

	QUnit.test( 'definitions: autoconfirmed, move-only or no protection is untrusted (wizz-definition-untrusted)', async ( assert ) => {
		const cases = [
			[ { type: 'edit', level: 'autoconfirmed' } ],
			[ { type: 'move', level: 'sysop' } ],
			[]
		];
		for ( const protection of cases ) {
			const defs = await loadDefinitions( fakeApi( () => defsResponse( protection ) ), [ 'Template:Infobox nhân vật', 'Template:Khác' ] );
			assert.false( defs[ 0 ].trusted, JSON.stringify( protection ) );
		}
	} );

	QUnit.test( 'definition with invalid JSON carries jsonError', async ( assert ) => {
		const api = fakeApi( () => ( { query: { pages: [ defPage( 'T', '{oops', [] ) ] } } ) );
		const defs = await loadDefinitions( api, [ 'Template:T' ] );
		assert.strictEqual( typeof defs[ 0 ].jsonError, 'string' );
	} );

	QUnit.test( 'loadSchema applies defaults', async ( assert ) => {
		const api = fakeApi( () => ( { query: { pages: [ { title: 'Bucket:nhan_vat', revisions: [ { slots: { main: { content: '{"ten":{"type":"TEXT"},"bn":{"type":"PAGE","index":false,"repeated":true}}' } } } ] } ] } } ) );
		const schema = await loadSchema( api, 'nhan_vat' );
		assert.deepEqual( schema, { name: 'nhan_vat', fields: {
			ten: { type: 'TEXT', index: true, repeated: false },
			bn: { type: 'PAGE', index: false, repeated: true }
		} } );
	} );

	QUnit.test( 'loadSchema: missing page or invalid JSON is wizz-definition-invalid', async ( assert ) => {
		await assert.rejects( loadSchema( fakeApi( () => ( { query: { pages: [ { title: 'Bucket:x', missing: true } ] } } ) ), 'x' ), ( e ) => e.code === 'wizz-definition-invalid' );
		await assert.rejects( loadSchema( fakeApi( () => ( { query: { pages: [ { title: 'Bucket:x', revisions: [ { slots: { main: { content: '[' } } } ] } ] } } ) ), 'x' ), ( e ) => e.code === 'wizz-definition-invalid' );
	} );

	QUnit.test( 'opening a form makes at most 3 API requests', async ( assert ) => {
		const api = fakeApi( ( p ) => {
			if ( p.list === 'tags' ) {
				return pageResponse();
			}
			if ( p.prop === 'revisions|info|redirects' ) {
				return defsResponse( [ { type: 'edit', level: 'sysop' } ] );
			}
			return { query: { pages: [ { title: 'Bucket:nhan_vat', revisions: [ { slots: { main: { content: '{}' } } } ] } ] } };
		} );
		const page = await loadPage( api, 'Song Ngư (nhân vật)' );
		const defs = await loadDefinitions( api, page.templates );
		await loadSchema( api, defs[ 0 ].bucket );
		assert.strictEqual( api.requests.length, 3 );
	} );
} );
