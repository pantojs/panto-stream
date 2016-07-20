/**
 * Copyright (C) 2016 yanni4night.com
 * file-content-cacher.js
 *
 * changelog
 * 2016-07-19[01:22:11]:revised
 *
 * @author yanni4night@gmail.com
 * @version 0.1.0
 * @since 0.1.0
 */
'use strict';
const DiskMap = require('disk-map');
const defineFrozenProperty = require('define-frozen-property');

/** class representing a FileContentCacher */
class FileContentCacher {
    constructor() {
        defineFrozenProperty(this, '_content', new DiskMap());
        defineFrozenProperty(this, '_map', new Map());
    }
    set(filename, file) {
        this._map.set(filename, file);
        this._content.set(filename, file.content);
        file.content = null;
    }
    get(filename) {
        const d = this._map.get(filename);
        if (d) {
            d.content = this._content.get(filename);
        }
        return d;
    }
    delete(filename) {
        this._content.delete(filename);
        this._map.delete(filename);
    }
    has(filename) {
        return this._map.has(filename);
    }
}

module.exports = FileContentCacher;
