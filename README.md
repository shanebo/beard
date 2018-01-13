Beard
===================

More than a mustache.

Released under a [MIT license](http://en.wikipedia.org/wiki/MIT_License).

Features
--------

* Clean syntax

Usage
-----

### Install ###

`npm install beard`

### API ###

``` js
const Beard = require('beard');
const engine = new Beard(cache, lookup);
engine.render(template, locals);
```

### Beard Constructor Arguments ###

**cache** - (object) An object literal containing your templates.

**lookup** - (function) A function that accepts the path value and can modify the path value before Beard looks up your template from the cache. E.g., `(path) => '/absolute/cached/path/${path}'`.

### Render Arguments ###

**template** - (string) A string to be parsed and populated by the view object.

**locals** - (object) An object of data and/or methods which will populate the template string.

### Example ###

``` js
const templates = {
	'example': '{{noun}} get {{makeUpperCase('stinky')}}.'
};

const locals = {
	noun: "Beards",
	makeUpperCase: function(str){
		return str.toUpperCase();
	}
};

const Beard = require('beard');
const engine = new Beard(templates);
const result = engine.render('{{include example}}', locals);
console.log(result); // returns 'Beards get STINKY.'

```

### More docs to come... ###

* cache
* optional cache lookup function 


### Thanks to ###

* keeto (Mark Obcena) for the parser/compiler
* shinetech (Danny Brain) for syntax ideas
* joeosburn (Joe Osburn) for the updated compiler, cached compiled functions, tests, and benchmarks
