'use strict';

const KeepTime = require('keeptime');

var MAS = function(enableDebug) {
	this.debug = enableDebug ? true : false;
	this.initSet = new Set();
	this.waitSet = new Set();
    this.allRegistrationsDone = false;
	this.initsCompletedOK = 0;
	this.initsFailed = 0;
	this.error = undefined;
};

MAS.prototype.wait = function(caller) {
	if (this.error) {
		return Promise.reject(createError('Module initialization error', this.error));
	}
	if (this.initSet.size == 0) {
		return Promise.resolve();
	}
	return new Promise(function(resolve, reject) {
		this.waitSet.add({ resolve: resolve, reject: reject, caller: caller });
	}.bind(this));
};

MAS.prototype.registerInitialization = function(p, caller) {
	var wp, timeout, kt = new KeepTime();
	if (this.allRegistrationsDone) {
		throw new Error('Late initialization registration');
	}
	var periodic = function () {
		if (timeout) {
			timeout = undefined;
			if (this.debug) {
				console.log('Module initialization ' +
							(caller ? ('from ' + caller + ' ') : '') +
							'still in progress after ' +
							kt.get().toFixed(6) +
							' seconds.');
			}
		}
		timeout = setTimeout(periodic, 1000);
	}.bind(this);
	wp = (Promise.resolve()
		  .then(function() {
			  kt.start();
			  if (this.debug) {
				  console.log('Module initialization ' +
							  (caller ? ('from ' + caller + ' ') : '') +
							  'starts.');
			  }
			  periodic();
			  return Promise.resolve(p);
		  }.bind(this))
		  .then(function() {
			  kt.stop();
			  if (timeout) {
				  clearTimeout(timeout);
				  timeout = undefined;
			  }
			  if (this.debug) {
				  console.log('Module initialization ' +
							  (caller ? ('from ' + caller + ' ') : '') +
							  'successfully completes in progress after ' +
							  kt.get().toFixed(6) +
							  ' seconds.');
			  }
			  this.initSet.delete(wp);
			  this.initsCompletedOK++;
			  if (this.error) {
				  return;
			  }
			  if (this.initSet.size == 0) {
				  this.waitSet.forEach(function(w) {
					  this.waitSet.delete(w);
					  try {
						  w.resolve();
					  } catch(e) {
					  }
				  }.bind(this));
			  }
		  }.bind(this))
		  .catch(function(e) {
			  kt.stop();
			  if (timeout) {
				  clearTimeout(timeout);
				  timeout = undefined;
			  }
			  if (this.debug) {
				  console.log('Module initialization ' +
							  (caller ? ('from ' + caller + ' ') : '') +
							  'FAILS in progress after ' +
							  kt.get().toFixed(6) +
							  ' seconds.');
			  }
			  this.initSet.delete(wp);
			  this.initsFailed++;
			  if (this.error) {
				  if (! Array.isArray(this.error)) {
					  this.error = [ this.error ];
				  }
				  this.error.push(e);
			  } else if (e) {
				  this.error = e;
			  } else {
				  this.error = new Error('Module initializer error caught');
			  }
			  e = createError('Module initialization error', this.error);
			  this.waitSet.forEach(function(w) {
				  this.waitSet.delete(w);
				  try {
					  w.reject(e);
				  } catch(e) {
				  };
			  }.bind(this));
		  }.bind(this)));
	this.initSet.add(wp);
};


function createError(m, e) {
	var ee, em, es, i;
	if (! (m && (typeof(m) === 'string') && (m.length > 0))) {
		m = 'Unknown error';
	}
	if (e) {
		if (! Array.isArray(e)) {
			e = [e];
		}
		if (e.length > 0) {
			em = m + (' (' + e.length.toFixed(0) + ' error' + ((e.length > 1) ? 's' : '') + ': ');
			i = 0;
			e.forEach(function(e) {
				i++;
				if (i > 1) {
					em += ', ';
				}
				if (e instanceof Error) {
					em += e.message;
				} else if ((typeof(e) === 'string') && (e.length > 0)) {
					em += e;
				} else {
					em += '???';
				}
			});
			em += ')';
			ee = new Error(em);
			i = 0;
			e.forEach(function(e) {
				i++;
				if (e instanceof Error) {
					ee.stack += "\n  #" + i.toFixed(0) + ': ' + e.stack;
				} else if ((typeof(e) === 'string') && (e.length > 0)) {
					ee.stack += "\n  #" + i.toFixed(0) + ' Error: ' + e;
					ee.stack += "\n  " + '  <no stack trace>';
				} else {
					ee.stack += "\n  #" + i.toFixed(0) + ' Error: ' + '<no error message>';
					ee.stack += "\n  " + '  <no stack trace>';
				}
			});
		} else {
			ee = new Error(m);
		}
	} else {
		ee = new Error(m);
	}
	return ee;
}

function getCaller() {
	var m, l = (new Error('x').stack.split("\n"))[3];
	if (typeof(l) === 'string') {
		if (m = l.match(/^\s*at\s\s*(.*)$/)) {
			l = m[1];
		}
	} else {
		l = 'unknown';
	}
	return l;
}

module.exports = function(moduleInitializerFunction, deferThrowError, enableDebug) {
	var moduleInitWait, moduleAsyncInit, moduleRegisterInitialization, err;
	moduleAsyncInit = new MAS(enableDebug ? true : false);
	moduleInitWait = function() {
		return moduleAsyncInit.wait(getCaller());
	}.bind(moduleAsyncInit);
	moduleRegisterInitialization = function(p) {
		return moduleAsyncInit.registerInitialization(p, getCaller());
	}.bind(moduleAsyncInit);
	try {
		moduleInitializerFunction(moduleRegisterInitialization);
	} catch (e) {
		moduleInitWait = function() {
			return Promise.reject(new Error('Unable to setup async module initialization'));
		};
		moduleAsyncInit.registerInitialization(Promise.reject(e), undefined);
		err = e;
	}
	if (err) {
		moduleAsyncInit.error = err;
		if (! deferThrowError) {
			throw err;
		}
	}
	moduleAsyncInit.allRegistrationsDone = true;
	return moduleInitWait;
};
