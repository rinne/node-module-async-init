'use strict';

module.exports = function (a, b, c) {
  var rv = (moduleInitWait()
            .then(function() {
				return new Promise(function(resolve, reject) {
					setTimeout(resolve, Math.round((Math.random() * 250 + 100)));
				});
            })
			.then(function() {
				throw new Error('Synthetic error for negative use case');
			})
            .catch(function(e) {
              throw e;
            }));
  return rv;
}

function moduleInitialize(moduleRegisterInitialization) {
	moduleRegisterInitialization(Promise.resolve());
	moduleRegisterInitialization(Promise.resolve()
								 .then(function() {
									 return new Promise(function(resolve, reject) {
										 setTimeout(resolve, Math.round((Math.random() * 500 + 250)));
									 });
								 })
								 .catch(function(e) {
									 throw e;
								 }));
}

// The following should be more or like verbatim line all modules.
var moduleInitWait = ((require('../module-async-init.js'))(moduleInitialize));
