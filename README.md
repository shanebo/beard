# Beard

More than a mustache.

## Features

* Clean syntax
* Ability to dynamically cache templates
* Cached rendered templates for faster renders

## Install

`npm install beard`

## Usage

``` js
const data = {
  noun: 'beards',
  capitalize: str => str.charAt(0).toUpperCase() + str.slice(1)
};

const Beard = require('beard');
const engine = new Beard({
  templates: {
    '/example': '{{capitalize(noun)}} are itchy.'
  }
});
const result = engine.render('/example', data);
console.log(result); // returns 'Beards are itchy.'
```

### Constructor Arguments

**opts** (object) - An object literal with the following optional engine options:

- **templates** (object) - An object literal containing your templates index.
- **root** (string) - The absolute path to the root directory where all templates are stored. If you provide a root directory, beard will create your templates cache for you.
- **home** (string) - Relative path to home directory (used via `'~'` in paths, E.g. `'~/layout'`).
- **cache** (boolean) - Set to `false` to disable caching of template files. Defaults to `true`.

### Render Arguments

**path** (string) - A string to be parsed and populated by the view object.

**locals** (object) - An object of data and/or methods which will populate the template string.

## Examples

``` js
const Beard = require('beard');
const engine = new Beard({
  templates: {
    '/layout': 'header | {{view}} | footer',
    '/app/page/content': "{{extends '/layout'}}content {{include '~/component'}}",
    '/app/component': 'and component'
  },
  root: '/',
  home: 'app/',
  cache: true
});
const result = engine.render('/app/page/content');
console.log(result); // returns 'header | content and component | footer'

```

### include
Includes a template, can optionally pass locals.

```
{{include 'template'}}
{{include('template', {arg: 'val', arg2: 'val2'})}}
```

### extends
Extends template with a layout. Template will be accessible as "view" variable.

**layout.brd.html**

```
<html>
  <body>
    {{view}}
  </body>
</html>
```

and rendering:

```
{{extends 'layout'}}view content
```

Returns:

```
<html>
  <body>
    view content
  </body>
</html>
```

### block
Makes content available as variable name.

```
{{block middle}}
  Middle
{{endblock}}

Top

{{middle}}

Bottom
```

Returns:

```
Top
Middle
Bottom
```

### conditionals

```
{{if x === 1}}
  x is 1
{{else if x > 1}}
  x is greater than 1
{{else}}
  x is less than 1
{{end}}
```

### for loop
Iterate over properties in object.

```
{{for key, value in object}}
  {{key}} = {{value}}
{{end}}
```

#### each loop
Iterate over array.

```
{{each item in array}}
  {{item.property}}
{{end}}
```

## Thanks to

* keeto (Mark Obcena) for the first iteration of the parser/compiler
* joeosburn (Joe Osburn) for the updated compiler, cached compiled functions, tests, and benchmarks

Released under [MIT license](http://en.wikipedia.org/wiki/MIT_License).