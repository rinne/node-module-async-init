'use strict';

var t = require('./ok.js');
var f = require('./fail.js');

(function() {
	var i, a = [];
	for (i = 0; i < 2000; i += 20) {
		a.push((Promise.resolve()
				.then(function() {
					return new Promise(function(resolve, reject) {
						setTimeout(resolve, i);
					});
				})
				.then(function() {
					return t();
				})
				.then(function() {
					return true;
				})
				.catch(function(e) {
					throw e;
				})));
		a.push((Promise.resolve()
				.then(function() {
					return new Promise(function(resolve, reject) {
						setTimeout(resolve, i);
					});
				})
				.then(function() {
					return f();
				})
				.then(function() {
					// We should not land here in negative test case.
					throw true;
				})
				.catch(function(e) {
					if (e === true) {
						throw new Error('Unexpected success in negative test case');
					}
					// We should land here in negative case
					return true;
				})));
	}
	return (Promise.all(a)
			.then(function(ret) {
				console.log('all ' + ret.length + ' tests ok');
			})
			.catch(function(e) {
				console.log(e);
				process.exit(1);
			}));
})();
