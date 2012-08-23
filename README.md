[![build status](https://secure.travis-ci.org/shanebo/beard.png)](http://travis-ci.org/shanebo/beard)
Beard
===================

More than a mustache.

Released under a [MIT license](http://en.wikipedia.org/wiki/MIT_License).

Features
--------

* Clean syntax

Usage
-----

### Syntax ###

	Beard.render(template, view);

### Arguments ###

**template** - (string) A string to be parsed and populated by the view object.

**view** - (object) An object of data and/or methods which will populate the template string.

### Example ###

	var Beard = require('beard');

	var view = {
		noun: "Beards",
		makeUpperCase: function(str){
			return str.toUpperCase();
		}
	};

	var html = Beard.render('{noun} are {makeUpperCase('awesome')}!', view);


More docs later...


### Thanks to ###

* keeto (Mark Obcena) for the parser/compiler
* shinetech (Danny Brain) for syntax ideas