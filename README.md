# panto-stream
[![NPM version][npm-image]][npm-url] [![Downloads][downloads-image]][npm-url] [![Build Status][travis-image]][travis-url] [![Coverage Status][coverage-image][coverage-url] [![Dependency status][david-dm-image]][david-dm-url] [![Dev Dependency status][david-dm-dev-image]][david-dm-dev-url]

Stream for panto.

```js
const Stream = ('panto-stream');

const s = new Stream(null, '*.js');

s.pipe(transformer).end();

s.flow().then(...);
```

## apis
 - pipe(transformer):
 - end(tag):
 - push(diff, force)
 - isRest()
 - flow()

[npm-url]: https://npmjs.org/package/panto-stream
[downloads-image]: http://img.shields.io/npm/dm/panto-stream.svg
[npm-image]: http://img.shields.io/npm/v/panto-stream.svg
[travis-url]: https://travis-ci.org/pantojs/panto-stream
[travis-image]: http://img.shields.io/travis/pantojs/panto-stream.svg
[david-dm-url]:https://david-dm.org/pantojs/panto-stream
[david-dm-image]:https://david-dm.org/pantojs/panto-stream.svg
[david-dm-dev-url]:https://david-dm.org/pantojs/panto-stream#info=devDependencies
[david-dm-dev-image]:https://david-dm.org/pantojs/panto-stream/dev-status.svg
[coverage-image]:https://coveralls.io/repos/github/pantojs/panto-stream/badge.svg?branch=master
[coverage-url]:https://coveralls.io/github/pantojs/panto-stream?branch=master