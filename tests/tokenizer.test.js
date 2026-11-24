'use strict';

const fs = require( 'fs' );
const path = require( 'path' );
const QUnit = require( 'qunit' );
const tokenizer = require( '../src/wizz-tokenizer.js' );

const dir = path.join( __dirname, 'fixtures', 'roundtrip' );
const names = fs.readdirSync( dir )
	.filter( ( f ) => f.endsWith( '.wikitext' ) )
	.map( ( f ) => f.slice( 0, -'.wikitext'.length ) );
const read = ( name, ext ) => fs.readFileSync( path.join( dir, name + ext ), 'utf8' );
const stripComments = ( s ) => s.replace( /<!--[\s\S]*?-->/g, '' );

/* Minimal reader for the preprocessor XML of action=parse&prop=parsetree. */
function parseXml( xml ) {
	const root = { name: '#root', attrs: {}, children: [] };
	const stack = [ root ];
	const decode = ( s ) => s.replace( /&lt;/g, '<' ).replace( /&gt;/g, '>' )
		.replace( /&quot;/g, '"' ).replace( /&amp;/g, '&' );
	const re = /<(\/?)([a-z]+)((?:\s+[A-Za-z]+="[^"]*")*)\s*(\/?)>|([^<]+)/g;
	let m;
	while ( ( m = re.exec( xml ) ) ) {
		const top = stack[ stack.length - 1 ];
		if ( m[ 5 ] !== undefined ) {
			top.children.push( decode( m[ 5 ] ) );
		} else if ( m[ 1 ] ) {
			stack.pop();
		} else {
			const attrs = {};
			m[ 3 ].replace( /([A-Za-z]+)="([^"]*)"/g, ( _, k, v ) => ( attrs[ k ] = v ) );
			const node = { name: m[ 2 ], attrs, children: [] };
			top.children.push( node );
			if ( !m[ 4 ] ) {
				stack.push( node );
			}
		}
	}
	return root;
}

const child = ( node, name ) => node.children.find( ( c ) => c.name === name );

/* Rebuild the wikitext a node stands for. */
function render( node ) {
	if ( typeof node === 'string' ) {
		return node;
	}
	const kids = () => node.children.map( render ).join( '' );
	const parts = () => node.children.filter( ( c ) => c.name === 'part' ).map( ( p ) => {
		const eq = child( p, 'equals' );
		return '|' + ( eq ? render( child( p, 'name' ) ) + '=' : '' ) + render( child( p, 'value' ) );
	} ).join( '' );
	switch ( node.name ) {
		case 'template':
			return '{{' + render( child( node, 'title' ) ) + parts() + '}}';
		case 'tplarg':
			return '{{{' + render( child( node, 'title' ) ) + parts() + '}}}';
		case 'ext': {
			const inner = child( node, 'inner' );
			const head = '<' + render( child( node, 'name' ) ) + render( child( node, 'attr' ) );
			return inner ? head + '>' + render( inner ) + render( child( node, 'close' ) ) : head + '/>';
		}
		default:
			return kids();
	}
}

const notACall = ( title ) => /^\s*(#|subst:|safesubst:|:)/i.test( title );

/* Templates not nested in another template/argument/extension tag. */
function topTemplates( node, out ) {
	for ( const c of node.children ) {
		if ( typeof c === 'string' ) {
			continue;
		}
		if ( c.name === 'template' ) {
			out.push( c );
		} else if ( c.name !== 'tplarg' && c.name !== 'ext' ) {
			topTemplates( c, out );
		}
	}
	return out;
}

QUnit.module( 'wizz-tokenizer' );

QUnit.test( 'fixture corpus has at least 20 fixtures', ( assert ) => {
	assert.true( names.length >= 20, names.length + ' fixtures' );
} );

for ( const name of names ) {
	const text = read( name, '.wikitext' );
	const edits = JSON.parse( read( name, '.edits.json' ) );

	if ( edits.parseError ) {
		QUnit.test( name + ': malformed markup throws wizz-parseerror with line', ( assert ) => {
			try {
				tokenizer.parse( text );
				assert.true( false, 'should have thrown' );
			} catch ( e ) {
				assert.strictEqual( e.code, 'wizz-parseerror', 'code' );
				assert.strictEqual( e.line, edits.parseError.line, 'line' );
			}
		} );
		continue;
	}

	QUnit.test( name + ': spans', ( assert ) => {
		const { calls } = tokenizer.parse( text );
		assert.true( calls.length > 0, 'has calls' );
		let last = 0;
		for ( const call of calls ) {
			assert.true( call.start >= last, 'calls in order' );
			last = call.end;
			assert.strictEqual( text.slice( call.start, call.start + 2 ), '{{', 'opens' );
			assert.strictEqual( text.slice( call.end - 2, call.end ), '}}', 'closes' );
			assert.true( text.slice( call.start + 2, call.end ).trim().startsWith( call.nameText ), 'nameText' );
			for ( const p of call.params ) {
				assert.strictEqual( text.slice( p.valueSpan[ 0 ], p.valueSpan[ 1 ] ), p.rawValue, 'rawValue' );
				assert.strictEqual( p.value, tokenizer.trimParts( p.rawValue )[ 1 ], 'value' );
				assert.true( p.valueSpan[ 0 ] >= call.start && p.valueSpan[ 1 ] <= call.end - 2, 'inside call' );
				if ( typeof p.name === 'string' ) {
					assert.strictEqual( stripComments( text.slice( p.nameSpan[ 0 ], p.nameSpan[ 1 ] ) ).trim(),
						p.name, 'name span' );
					assert.strictEqual( text[ p.valueSpan[ 0 ] - 1 ], '=', 'value follows =' );
				} else {
					assert.strictEqual( p.nameSpan, null, 'positional has no name span' );
				}
			}
		}
	} );

	QUnit.test( name + ': agrees with core parse tree', ( assert ) => {
		const tree = parseXml( read( name, '.parsetree.xml' ) );
		const expected = topTemplates( tree, [] ).filter( ( t ) => !notACall( render( child( t, 'title' ) ) ) );
		const { calls } = tokenizer.parse( text );
		assert.strictEqual( calls.length, expected.length, 'number of calls' );
		calls.forEach( ( call, i ) => {
			const t = expected[ i ];
			assert.strictEqual( call.nameText, render( child( t, 'title' ) ).trim(), 'template name' );
			const parts = t.children.filter( ( c ) => c.name === 'part' );
			assert.strictEqual( call.params.length, parts.length, 'number of params' );
			parts.forEach( ( part, j ) => {
				const p = call.params[ j ];
				const nameNode = child( part, 'name' );
				if ( child( part, 'equals' ) ) {
					assert.strictEqual( p.name, stripComments( render( nameNode ) ).trim(), 'param name' );
				} else {
					assert.strictEqual( p.name, Number( nameNode.attrs.index ), 'positional index' );
				}
				assert.strictEqual( p.rawValue, render( child( part, 'value' ) ), 'param value' );
			} );
		} );
	} );
}

QUnit.test( 'param details: positional, duplicates, trimmed values', ( assert ) => {
	const { calls } = tokenizer.parse( '{{T | x |a= 1 |b =\n2\n|a= 3 }}' );
	const p = calls[ 0 ].params;
	assert.deepEqual( p.map( ( x ) => x.name ), [ 1, 'a', 'b', 'a' ] );
	assert.deepEqual( p.map( ( x ) => x.value ), [ 'x', '1', '2', '3' ] );
	assert.strictEqual( p[ 2 ].rawValue, '\n2\n' );
	assert.strictEqual( calls[ 0 ].nameText, 'T' );
} );

QUnit.test( 'index counts calls of the same template', ( assert ) => {
	const { calls } = tokenizer.parse( '{{A}}{{b}}{{A|x}}{{ A }}{{b}}' );
	assert.deepEqual( calls.map( ( c ) => c.index ), [ 0, 0, 1, 2, 1 ] );
} );

QUnit.test( 'offsets are UTF-16 string indices', ( assert ) => {
	const text = '😀{{T|a=😀}}';
	const c = tokenizer.parse( text ).calls[ 0 ];
	assert.strictEqual( c.start, 2 );
	assert.strictEqual( text.slice( c.start, c.end ), '{{T|a=😀}}' );
} );

QUnit.test( 'only top-level calls are returned', ( assert ) => {
	const { calls } = tokenizer.parse( '{{A|x={{B|y=1}}}} [[l|{{C}}]]' );
	assert.deepEqual( calls.map( ( c ) => c.nameText ), [ 'A', 'C' ] );
} );

QUnit.test( 'parser functions, subst:, safesubst: and : are not template calls', ( assert ) => {
	const text = '{{#if:a|b}}{{ #switch:x|y}}{{subst:T}}{{SafeSubst:T}}{{:Page}}{{!}}{{Real|a=1}}';
	const names2 = tokenizer.parse( text ).calls.map( ( c ) => c.nameText );
	assert.deepEqual( names2, [ '!', 'Real' ] );
} );

QUnit.test( 'malformed markup throws with 1-based line', ( assert ) => {
	const cases = [
		[ 'a\n{{T|x', 2 ],
		[ '{{T|a=<ref>x}}', 1 ],
		[ 'x\ny\n<!-- open', 3 ],
		[ '{{T|a=<nowiki>}}', 1 ],
		[ '{{T|a=[[x}}', 1 ]
	];
	for ( const [ text, line ] of cases ) {
		assert.throws(
			() => tokenizer.parse( text ),
			( e ) => e.code === 'wizz-parseerror' && e.line === line,
			JSON.stringify( text )
		);
	}
} );

QUnit.test( 'stray closers and unclosed links outside calls are literal', ( assert ) => {
	assert.strictEqual( tokenizer.parse( 'a }} b ]] [[c {{T|a=1}}' ).calls.length, 1 );
} );

QUnit.test( 'timing: 200 KB page parses in under 50 ms', ( assert ) => {
	const block = 'Some text with [[link|label]] and a table.\n' +
		'{{Infobox person\n| name = An<ref name="a">{{cite|url=x|title=y}}</ref>\n' +
		'| born = {{birth date|1990|1|2}} <!-- c -->\n| image = [[File:A.jpg|thumb|x]]\n}}\n' +
		'<nowiki>{{x}}</nowiki> {{{1|d}}}\n';
	const text = block.repeat( Math.ceil( 200 * 1024 / block.length ) );
	tokenizer.parse( block );
	const t0 = process.hrtime.bigint();
	const { calls } = tokenizer.parse( text );
	const ms = Number( process.hrtime.bigint() - t0 ) / 1e6;
	assert.true( text.length >= 200 * 1024, 'page is at least 200 KB' );
	assert.true( calls.length > 100, 'found calls' );
	assert.true( ms < 50, ms.toFixed( 1 ) + ' ms' );
} );

QUnit.test( 'index counts by normalised name: prefix, underscore, comment', ( assert ) => {
	const { calls } = tokenizer.parse( '{{Infobox x}}{{Template:infobox_x}}{{Infobox<!-- c --> x}}' );
	assert.deepEqual( calls.map( ( c ) => c.index ), [ 0, 1, 2 ] );
} );
