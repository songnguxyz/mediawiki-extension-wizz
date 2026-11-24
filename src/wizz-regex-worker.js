// Worker source for FieldDefinition.pattern (research R6). It is bundled as a string and run
// from a Blob URL, so it must be self-contained.
// Request { pattern, value } -> reply { match } or { invalid } when the pattern does not compile.
self.onmessage = ( e ) => {
	try {
		self.postMessage( { match: new RegExp( e.data.pattern, 'u' ).test( e.data.value ) } );
	} catch ( err ) {
		self.postMessage( { invalid: true } );
	}
};
