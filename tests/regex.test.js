'use strict';

const fs = require( 'fs' );
const path = require( 'path' );
const { Worker } = require( 'worker_threads' );
const { testPattern, validatePattern, stopWorker } = require( '../src/wizz-validate.js' );

const source = fs.readFileSync( path.join( __dirname, '../src/wizz-regex-worker.js' ), 'utf8' );

// Gives a worker_threads Worker the Web Worker surface the worker source uses.
function createWorker( src ) {
	const prelude = 'const { parentPort } = require( "worker_threads" );' +
		'globalThis.self = { postMessage: ( m ) => parentPort.postMessage( m ),' +
		'set onmessage( f ) { parentPort.on( "message", ( data ) => f( { data } ) ); } };';
	const w = new Worker( prelude + src, { eval: true } );
	return {
		postMessage: ( m ) => w.postMessage( m ),
		terminate: () => w.terminate(),
		set onmessage( f ) {
			w.removeAllListeners( 'message' );
			w.on( 'message', ( data ) => f( { data } ) );
		},
		set onerror( f ) {
			w.removeAllListeners( 'error' );
			w.on( 'error', f );
		}
	};
}
const regex = { createWorker, source };

QUnit.module( 'wizz-regex', { afterEach: stopWorker } );

QUnit.test( 'pattern is applied with flag u', async ( assert ) => {
	assert.deepEqual( await testPattern( '^\\p{L}+$', 'Ngư', regex ), { match: true } );
	assert.deepEqual( await testPattern( '^\\p{L}+$', 'Ng1', regex ), { match: false } );
	assert.deepEqual( await testPattern( '^.$', '😀', regex ), { match: true }, 'u: one code point' );
} );

QUnit.test( 'catastrophic pattern: wizz-error-regex-timeout within about 200 ms, worker recreated', async ( assert ) => {
	const value = 'a'.repeat( 40 ) + '!';
	const start = Date.now();
	assert.deepEqual( await testPattern( '(a+)+$', value, regex ), { error: 'wizz-error-regex-timeout' } );
	assert.true( Date.now() - start < 1000, 'returned in ' + ( Date.now() - start ) + ' ms' );
	assert.deepEqual( await testPattern( '^a+$', 'aaa', regex ), { match: true }, 'usable again' );
} );

QUnit.test( 'invalid pattern is reported unavailable, not thrown', async ( assert ) => {
	assert.deepEqual( await testPattern( '(', 'x', regex ), { error: 'wizz-error-regex-unavailable' } );
} );

QUnit.test( 'fallback when no Worker can start: safe patterns on short values only', async ( assert ) => {
	const blocked = () => {
		throw new Error( 'blocked' );
	};
	const broken = { createWorker: blocked, source };
	assert.deepEqual( await testPattern( '^a+$', 'aaa', broken ), { match: true } );
	assert.deepEqual( await testPattern( '^a+$', 'b', broken ), { match: false } );
	assert.deepEqual( await testPattern( '(a+)+$', 'aaa', broken ), { error: 'wizz-error-regex-unavailable' }, 'nested quantifier' );
	assert.deepEqual( await testPattern( '^a+$', 'a'.repeat( 201 ), broken ), { error: 'wizz-error-regex-unavailable' }, 'long value' );
} );

QUnit.test( 'validatePattern: per item, error carries the failing item', async ( assert ) => {
	const f = { type: 'TEXT', repeated: true, rules: { pattern: '^\\d+$', separator: ';' } };
	assert.deepEqual( await validatePattern( f, '1; 22', regex ), [] );
	const e = await validatePattern( f, '1; x2; 3', regex );
	assert.deepEqual( e.map( ( x ) => [ x.key, x.params[ 0 ] ] ), [ [ 'wizz-error-pattern', 'x2' ] ] );
	assert.deepEqual( await validatePattern( { type: 'INTEGER', rules: { pattern: 'x' } }, 'y', regex ), [], 'TEXT only' );
	assert.deepEqual( await validatePattern( { type: 'TEXT', rules: { pattern: 'x' } }, '', regex ), [], 'empty skipped' );
	const t = await validatePattern( { type: 'TEXT', rules: { pattern: '(a+)+$' } }, 'a'.repeat( 40 ) + '!', regex );
	assert.deepEqual( t.map( ( x ) => x.key ), [ 'wizz-error-regex-timeout' ] );
} );
