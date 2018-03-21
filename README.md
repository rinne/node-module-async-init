In a Nutshell
=============

This is a small helper library for implementing asynchronous
initialization within javascript submodules implementing asynchronous
API typically with promises. Multiple issues are tackled:

1) Required initializations may be asynchronous and can't be completed
   before the module returns control back to the code loading the
   module.
2) The initializations should be started immediately when the module
   is loaded, not only when some function exported by the module is
   called.
3) If a function exported by the module is called before the
   initializations are complete, it should wait until the
   initializations are competed and it can safely run.
4) If the initialization fails, all calls to any function exported by
   the module should return a sensible error rather than something
   generic from the bottom of the call stack or, what is even worse,
   never return anything.
5) Multiple independent initialization tasks in a single module can
   take place in parellel.
   other.
6) Multiple modules can initialize themselves in parallel.
7) New initializations should be easy to add to existing code without
   redesigning everything.
8) No initialization calls should be needed by the code loading the
   module. Simple require('module') should be enough.

All above is particularly useful in serverless environments such as
AWS Lambda but can be used really anywhere.


Reference
=========

The library is typically used in submodules that when loaded perform
some asynchronous initialization. If functions exported by the module
are called while the initialization is still in progress, the
execution should wait for the initialization to complete. The exported
functions should also fail with error, in case initialization fails.

Asynchronous initialization is implemented by adding the following to
the end of the module file:

```
// This is a custom function initiating all the initializations
// required by the module. This one is the one you should modify.
function moduleInitialize(moduleRegisterInitialization) {
   // All initializations must be implemented in such a way
   // that they return a Promise instance that resolves when 
   // the initialization is complete or rejects (i.e. throws
   // error) in case the initialization fails. These
   // initialization promises are registered by using
   // moduleRegisterInitialization callback function.
   // Examples below.
   var p;
   p = (Promise.resolve()
        .then(function() {
          // Initialize something
        })
        .then(function() {
          // Initialize something else
        })
        .catch(function(e) {
          // Something went wrong.
          // You may want to print error
          console.log(e);
          // You definitely want to rethrow error
          throw e;
        }));
  moduleRegisterInitialization(p);
  p = Promise.resolve(); // What a short no-op initialization.
  moduleRegisterInitialization(p);
  // Register as many initialization promises as you like.
}

// The following should be more or less verbatim line all modules.
// However passing a truth-like value as additional argument along
// with moduleInitialize, the possible error thrown during the
// execution of moduleInitialize is caught and deferred until
// something calls moduleInitWait.
var moduleInitWait = ((require('module-async-init'))(moduleInitialize));
```

This library is mainly aimed for modules that export functions
returning promises. All such functions that require module
initializations to be complete before execution, should look something
like the following:

```
function myFunction(a, b, c) {
  var rv = (moduleInitWait()
            .then(function() {
              // do...
            })
            .then(function() {
              // ...something...
            })
            .then(function() {
              // ...useful
            })
            .catch(function(e) {
              throw e;
            }));
  return rv;
}
```

If you really want to use callbacks in your API instead of promises,
it is of course possible, but why would you?

However after node.js 8.0 you might want to use async functions and
awaits and it is very much possible. More extensive example below:

```
'use strict';

async function delay(ms) {
    await new Promise((resolve, reject) => { setTimeout(resolve, ms); });
}

async function initializeSomethingAsync(n) {
    var s = Math.trunc((Math.random() * 240) + 10);
    await delay(s);
    console.log('[' + n + '] ' + 'initializing...');
    await delay(s);
    console.log('[' + n + '] ' + '...something...');
    await delay(s);
    console.log('[' + n + '] ' + '...very...');
    await delay(s);
    console.log('[' + n + '] ' + '...slowly...');
    await delay(s);
    console.log('[' + n + '] ' + '...and...');
    await delay(s);
    console.log('[' + n + '] ' + '...asynchronously');
    await delay(s);
    //throw new Error('Error thrown by async initializer');
}

function initializeSomethingSync(n) {    
    console.log('[' + n + '] ' + 'initializing something synchronously');
    //throw new Error('Error thrown by synchronous initializer');
}

// This function MUST NOT be asynchronous, but it can register an
// arbitrary number of promises (i.e. immediate return values from
// async functions) to be completed before the module is fully
// initialized.
function moduleInitialize(moduleRegisterInitialization) {
    var n = 0;
    moduleRegisterInitialization(initializeSomethingSync(++n));
    moduleRegisterInitialization(initializeSomethingAsync(++n));
    moduleRegisterInitialization(initializeSomethingSync(++n));
    moduleRegisterInitialization(initializeSomethingAsync(++n));
    moduleRegisterInitialization(initializeSomethingSync(++n));
    moduleRegisterInitialization(initializeSomethingAsync(++n));
    moduleRegisterInitialization(initializeSomethingSync(++n));
    moduleRegisterInitialization(initializeSomethingAsync(++n));
    moduleRegisterInitialization(initializeSomethingSync(++n));
    moduleRegisterInitialization(initializeSomethingAsync(++n));
    moduleRegisterInitialization(initializeSomethingSync(++n));
    moduleRegisterInitialization(initializeSomethingAsync(++n));
}

// Setting the boolean argument to true causes errors thrown during
// the execution of by moduleInitialize to be caught but deferred
// until someone calls moduleInitWait. If it's omitted of false, then
// the error is thrown immediately.
var moduleInitWait = ((require('module-async-init'))(moduleInitialize, false));

// This is just an example.
(async function() {
    try {
        await moduleInitWait();
        console.log('ALL INITIALIZATIONS SEEM TO BE DONE!');
    } catch(e) {
        console.log(e);
        console.log(new Error('foo'));
    }
})();
```

In some cases, mainly for debugging, you might want to export from
your module a function that just waits for the initializations to
complete. This can be done simply by exporting moduleInitWait among
the methods actually doing something module specific.

```
async function myFunc1() {
    try {
        await moduleInitWait();
        // do something
    } catch(e) {
        // do something    
    };
}

function moduleInitialize(moduleRegisterInitialization) {
    // You probably want to initialize something here
    // or maybe just reserve it for future use
}
var moduleInitWait = ((require('module-async-init'))(moduleInitialize));

module.exports = {
    moduleInitWait: moduleInitWait,
    myFunc1: myFunc1
};
```

It's not too good idea to mix synchronous functions with asynchronous
ones, let alone making the execution of a synchronous function depend
from the asynchronous initialization of the module, but if absolutely
necessarily, it's quite trivial to do. Something like this:

```
async function myFunc1() {
    try {
        await moduleInitWait();
        // do something
    } catch(e) {
        // do something
    };
}

function myFunc2() {
    if (! moduleInitComplete) {
        throw new Error('Module not initialized');
    }
    // Do something nice and synchronous
    // and return something useful.
}

function moduleInitialize(moduleRegisterInitialization) {
    // You probably want to initialize something here
    // or maybe just reserve it for future use
}
var moduleInitWait = ((require('module-async-init'))(moduleInitialize));

var moduleInitComplete = false;
(async function() {
    try {
        await moduleInitWait();
        console.log('Module initialization ok');
        moduleInitComplete = true;
    } catch (e) {
        console.log('Module initialization failed');
        console.log(e);
        process.exit(1);
    }
})();

module.exports = {
    myFunc1: myFunc1,
    myFunc2: myFunc2
};
```

If you feel particularly lazy or have an existing module, you might
want to use a magic wrapper to make all your exported functions
initialization aware without actually editing them too much.

```
'use strict';

// This is the original code without any initializations.

function f1() { /* Something asynchronous probably returnining a promise */}
function f2() { /* Something asynchronous probably returnining a promise */}
function f3() { /* Something synchronous returning a value immediately   */}

module.exports = {
    f1: f1,
    f2: f2,
    f3: f3
};
```

becomes

```
'use strict';

// This is the same code pimped so that initializations are completed
// before exported functions can execute, but they can nevertheless be
// called immediately.

function f1() { /* Something asynchronous probably returnining a promise */}
function f2() { /* Something asynchronous probably returnining a promise */}
function f3() { /* Something synchronous returning a value immediately   */}

function moduleInitialize(moduleRegisterInitialization) {
    // Use moduleRegisterInitialization to register an arbitrary
    // number of pending initialization promises.
}
var moduleInitWait = ((require('module-async-init'))(moduleInitialize));

function moduleInitWaitWrapper(func) {
    return async function(...args) {
        try {
            await moduleInitWait();
            return await func(...args);
        } catch(e) {
            throw e;
        }
    }
}

module.exports = {
    f1: moduleInitWaitWrapper(f1),
    f2: moduleInitWaitWrapper(f2),
    f3: moduleInitWaitWrapper(f3) // Exported f3 becomes async too :(
};
```

And for all of us using node.js 6.x e.g. in AWS Lambda, here is a
non-async-await version of moduleInitWrapper.

```
function moduleInitWaitWrapper(func) {
    return function(...args) {
        return (moduleInitWait()
                .then(function() {
                    return func(...args);
                })
                .catch(function(e) {
                    throw e;
                }));
    }
}
```

The library also provides some debug output for ongoing
initializations. This is especially useful for situations where an
initialization is left hanging e.g. because of some unhandled
exception or some other bug. This is done by passing true as the third
parameter of the module setup. Like this:

```
var moduleInitWait = ((require('module-async-init'))(moduleInitialize, undefined, true));
```

This causes some console output for all initializations.

Author
======

Timo J. Rinne <tri@iki.fi>


License
=======

GPL-2.0
