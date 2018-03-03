'use strict';

var MAS = function() {
	this.initSet = new Set();
	this.waitSet = new Set();
    this.allRegistrationsDone = false;
	this.initsCompletedOK = 0;
	this.initsFailed = 0;
	this.error = undefined;
};

MAS.prototype.wait = function() {
	if (this.error) {
		return Promise.reject(createError('Module initialization error', this.error));
	}
	if (this.initSet.size == 0) {
		return Promise.resolve();
	}
	return new Promise(function(resolve, reject) {
		this.waitSet.add({ resolve: resolve, reject: reject });
	}.bind(this));
};

MAS.prototype.registerInitialization = function(p) {
	var wp;
	if (this.allRegistrationsDone) {
		throw new Error('Late initialization registration');
	}
	wp = (Promise.resolve()
		  .then(function() {
			  return Promise.resolve(p);
		  })
		  .then(function() {
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

module.exports = function(moduleInitializerFunction, deferThrowError) {
	var moduleInitWait, moduleAsyncInit, moduleRegisterInitialization, error;
	try {
		moduleAsyncInit = new MAS();
		moduleInitWait = function() { return moduleAsyncInit.wait(); };
		moduleRegisterInitialization = function(p) { return moduleAsyncInit.registerInitialization(p); };
		moduleInitializerFunction(moduleRegisterInitialization);
	} catch (e) {
		moduleInitWait = function() {
			return Promise.reject(new Error('Unable to setup async module initialization'));
		};
		moduleRegisterInitialization(Promise.reject(e));
		error = e;
	}
	if (error && (! deferThrowError)) {
		throw error;
	}
	moduleAsyncInit.allRegistrationsDone = true;
	return moduleInitWait;
};
