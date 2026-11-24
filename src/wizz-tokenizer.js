'use strict';

/**
 * Template call tokenizer. Follows the core preprocessor rules for the pieces that matter
 * here: comments, extension tags, `{{ }}`, `{{{ }}}` and `[[ ]]`. Pure, no `mw`/DOM.
 */

// Tags whose content the preprocessor keeps raw. ponytail: fixed list, not the wiki's
// registered tags; add when a wiki needs another one.
const EXT_TAGS = 'nowiki|pre|ref|references|gallery|poem|math|chem|syntaxhighlight|source|score|' +
	'templatedata|charinsert|hiero|inputbox|imagemap|timeline|mapframe|maplink|categorytree';
const tagStart = new RegExp( '<(' + EXT_TAGS + ')(?=[\\s/>])[^>]*?(/?)>', 'iy' );
const tagEnds = {};
const special = /[<{[}\]|=]/g;

/**
 * @param {string} text
 * @param {number} pos
 * @return {Object} wizz-parseerror
 */
function parseError( text, pos ) {
	let line = 1;
	for ( let i = text.indexOf( '\n' ); i !== -1 && i < pos; i = text.indexOf( '\n', i + 1 ) ) {
		line++;
	}
	return { code: 'wizz-parseerror', line: line };
}

/**
 * Split a raw value into leading whitespace/comments, the value, and trailing
 * whitespace/comments.
 *
 * @param {string} raw
 * @return {string[]} [ lead, value, trail ]
 */
function trimParts( raw ) {
	let s = 0;
	let e = raw.length;
	for ( ;; ) {
		if ( /\s/.test( raw[ s ] || 'x' ) ) {
			s++;
		} else if ( raw.startsWith( '<!--', s ) && raw.includes( '-->', s + 4 ) ) {
			s = raw.indexOf( '-->', s + 4 ) + 3;
		} else {
			break;
		}
	}
	while ( e > s ) {
		const c = raw.lastIndexOf( '<!--', e - 3 );
		if ( /\s/.test( raw[ e - 1 ] ) ) {
			e--;
		} else if ( raw.endsWith( '-->', e ) && c >= s && raw.indexOf( '-->', c + 4 ) === e - 3 ) {
			e = c;
		} else {
			break;
		}
	}
	return [ raw.slice( 0, s ), raw.slice( s, e ), raw.slice( e ) ];
}

/**
 * Normalise a template name or title: comments dropped, `_`/whitespace collapsed, the
 * `Template:` prefix (or a namespace alias with id 10) removed, first letter capitalised.
 * Titles in other namespaces keep a lowercase prefix.
 *
 * @param {string} name
 * @param {Object} [nsIds] lowercase namespace name (spaces as `_`) to id, like wgNamespaceIds
 * @return {string}
 */
function normalizeName( name, nsIds ) {
	let n = name.replace( /<!--[\s\S]*?-->/g, '' ).replace( /[\s_]+/g, ' ' ).trim();
	let prefix = '';
	const colon = n.indexOf( ':' );
	if ( colon > 0 ) {
		const ns = n.slice( 0, colon ).trim().toLowerCase().replace( / /g, '_' );
		const id = ns === 'template' ? 10 : ( nsIds || {} )[ ns ];
		if ( id !== undefined ) {
			prefix = id === 10 ? '' : id + ':';
			n = n.slice( colon + 1 ).trim();
		}
	}
	return prefix + n.charAt( 0 ).toUpperCase() + n.slice( 1 );
}

/**
 * @param {string} text
 * @param {Object} frame
 * @param {number} end index of the first closing brace
 * @return {Object|null} TemplateCall without `index`, or null for non-template calls
 */
function makeCall( text, frame, end ) {
	const nameEnd = frame.parts.length > 1 ? frame.parts[ 1 ].start - 1 : end;
	const nameText = text.slice( frame.parts[ 0 ].start, nameEnd ).trim();
	if ( /^(#|subst:|safesubst:|:)/i.test( nameText ) ) {
		return null;
	}
	let positional = 0;
	const params = frame.parts.slice( 1 ).map( ( part, i ) => {
		const partEnd = i + 2 < frame.parts.length ? frame.parts[ i + 2 ].start - 1 : end;
		if ( part.eq === -1 ) {
			return {
				name: ++positional,
				nameSpan: null,
				valueSpan: [ part.start, partEnd ],
				rawValue: text.slice( part.start, partEnd ),
				value: trimParts( text.slice( part.start, partEnd ) )[ 1 ]
			};
		}
		const rawName = text.slice( part.start, part.eq );
		const [ lead, core ] = trimParts( rawName );
		const raw = text.slice( part.eq + 1, partEnd );
		return {
			name: core.replace( /<!--[\s\S]*?-->/g, '' ).trim(),
			nameSpan: [ part.start + lead.length, part.start + lead.length + core.length ],
			valueSpan: [ part.eq + 1, partEnd ],
			rawValue: raw,
			value: trimParts( raw )[ 1 ]
		};
	} );
	return { nameText: nameText, params: params };
}

/**
 * Find the top-level template calls of a page. Calls nested in another template, argument
 * or extension tag are not returned. Unclosed `{{`, comments and extension tags throw.
 *
 * @param {string} text
 * @return {{calls: Object[]}} calls with `index` (among calls of the same normalised
 *  name), `start`, `end`, `nameText`, `params`
 * @throws {{code: string, line: number}} wizz-parseerror
 */
function parse( text ) {
	const calls = [];
	const seen = new Map();
	const stack = [];
	let braces = 0;
	let i = 0;
	for ( ;; ) {
		special.lastIndex = i;
		const m = special.exec( text );
		if ( !m ) {
			break;
		}
		i = m.index;
		const c = m[ 0 ];
		const top = stack[ stack.length - 1 ];
		if ( c === '<' ) {
			if ( text.startsWith( '<!--', i ) ) {
				const end = text.indexOf( '-->', i + 4 );
				if ( end === -1 ) {
					throw parseError( text, i );
				}
				i = end + 3;
				continue;
			}
			tagStart.lastIndex = i;
			const tag = tagStart.exec( text );
			if ( !tag ) {
				i++;
			} else if ( tag[ 2 ] ) {
				i += tag[ 0 ].length;
			} else {
				const name = tag[ 1 ].toLowerCase();
				const re = tagEnds[ name ] || ( tagEnds[ name ] = new RegExp( '</' + name + '\\s*>', 'gi' ) );
				re.lastIndex = i + tag[ 0 ].length;
				const close = re.exec( text );
				if ( !close ) {
					throw parseError( text, i );
				}
				i = close.index + close[ 0 ].length;
			}
		} else if ( c === '{' || c === '[' ) {
			let j = i;
			while ( text[ j ] === c ) {
				j++;
			}
			if ( j - i >= 2 ) {
				stack.push( { ch: c, count: j - i, start: i, parts: [ { start: j, eq: -1 } ] } );
				braces += c === '{' ? 1 : 0;
			}
			i = j;
		} else if ( c === '}' || c === ']' ) {
			let j = i;
			while ( text[ j ] === c ) {
				j++;
			}
			const open = c === '}' ? '{' : '[';
			if ( !top || top.ch !== open ) {
				i = j;
				continue;
			}
			const k = Math.min( j - i, top.count, open === '{' ? 3 : 2 );
			if ( k < 2 ) {
				i = j;
				continue;
			}
			top.count -= k;
			const start = top.start + top.count;
			const end = i + k;
			const done = top.count < 2;
			if ( done ) {
				stack.pop();
				braces -= open === '{' ? 1 : 0;
			}
			if ( open === '{' && k === 2 && braces === 0 ) {
				const call = makeCall( text, top, i );
				if ( call ) {
					const key = normalizeName( call.nameText );
					call.index = seen.get( key ) || 0;
					seen.set( key, call.index + 1 );
					call.start = start;
					call.end = end;
					calls.push( call );
				}
			}
			if ( !done ) {
				top.parts = [ { start: top.start + top.count, eq: -1 } ];
			}
			i = end;
		} else {
			if ( top && top.ch === '{' ) {
				if ( c === '|' ) {
					top.parts.push( { start: i + 1, eq: -1 } );
				} else if ( top.parts.length > 1 && top.parts[ top.parts.length - 1 ].eq === -1 ) {
					top.parts[ top.parts.length - 1 ].eq = i;
				}
			}
			i++;
		}
	}
	for ( const f of stack ) {
		if ( f.ch === '{' ) {
			throw parseError( text, f.start );
		}
	}
	return { calls: calls };
}

module.exports = { parse, trimParts, normalizeName };
