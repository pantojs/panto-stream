# panto-stream
[![NPM version][npm-image]][npm-url] [![Downloads][downloads-image]][npm-url] [![Build Status][travis-image]][travis-url] [![Coverage Status][coverage-image]][coverage-url] [![Dependency status][david-dm-image]][david-dm-url] [![Dev Dependency status][david-dm-dev-image]][david-dm-dev-url]

Stream for panto.

`v0.7.0` breaking change: _clearCache_ is removed.

```js
/**


🚴read(.js)------►filter(src/*.js)-------►babel--------
    |                                                |
    |                                                |
    |                                                |
    |                                                ▼
    |------------►filter(3rd/*.js)----------------►uglify
    |                                                |
    |                                                |
    |                                                |
    |                                                ▼
    |             🏅write◄--------uglify◄--------browserify
    |                                 |
    |                                 |
    |                                 |
    |                                 ▼
 filter(.html)--------------------►replace---------🎖write
*/
const PantoStream = ('panto-stream');

const origin = new PantoStream();
const read = new ReadTransformer();
const babel = new BabelTransformer();
const browserify = new BrowserifyTransformer();
const uglify = new UglifyTransformer();
const replace = new ReplaceTransformer();
const write = new WriteTransformer();
const filter = function(pattner) {
    return new FilterTransformer(pattern)
};

origin.pipe(read);

read.pipe(filter('src/*.js')).pipe(babel).pipe(browserify);
read.pipe(filter('3rd/*.js')).pipe(browserify)

read.pipe(filter('*.html')).pipe(replace);

browserify.pipe(uglify).pipe(write);

uglify.pipe(replace, false).pipe(write)

origin.freeze().flow([{filename, content}, {filename, content}]).then(files => {});
```

## API
 - constructor(transformer)
 - tag(string)
 - connect(stream, mergeFiles)
 - pipe(transformer, mergeFiles)
 - notify(...files)
 - freeze()
 - reset()
 - flow(files)
 - isConnectedWith(stream)

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