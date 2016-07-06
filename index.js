/**
 * Copyright (C) 2016 pantojs.xyz
 * index.js
 *
 * changelog
 * 2016-07-05[23:15:32]:revised
 *
 * @author yanni4night@gmail.com
 * @version 0.1.0
 * @since 0.1.0
 */
'use strict';
const minimatch = require('minimatch');
const FileCollection = require('./file-collection');
const EventEmitter = require('events');
const {flattenDeep, extend} = require('lodash');
const defineFrozenProperty = require('define-frozen-property');

/** Class representing a stream. */
class Stream extends EventEmitter {
    constructor(parent, pattern, transformer) {
        super();
        defineFrozenProperty(this, '_parent', parent);
        defineFrozenProperty(this, '_pattern', pattern);
        defineFrozenProperty(this, '_transformer', transformer);
        defineFrozenProperty(this, '_cacheFiles', new Map());
        this.tag = '';
    }
    /**
     * Create a new child stream with transformer.
     *
     * Child's "end" event will fire parent too.
     * 
     * @param  {Transformer} transformer
     * @return {Stream} The new stream
     */
    pipe(transformer) {
        const child = new Stream(this, this._pattern, transformer);
        child.on('end', leaf => {
            this.emit('end', leaf);
        });
        return child;
    }
    /**
     * If it's a rest stream.
     *
     * Rest stream will add the files rested.
     * 
     * @return {Boolean}
     */
    isRest() {
        return null === this._pattern;
    }
    /**
     * Try to fixed the matched/cached files according to diffs.
     * 
     * @param  {object} diff
     * @param  {Boolean} force
     * @return {Boolean} If fixed
     */
    fix(diff, force) {
        if ('change' === diff.cmd || 'remove' === diff.cmd) {
            this._cacheFiles.remove(diff.filename);
        }

        if (this._parent) {
            this._parent.fix(diff, force);
        }

        if (this._matchFiles && (force || (this._pattern && minimatch(diff.filename, this._pattern)))) {
            // clear content
            this._matchFiles.update(diff);

            return true;
        }
        return false;
    }
    /**
     * Flow the files, if has parent, parent flows first.
     * 
     * @param  {Array} files 
     * @return {Promise}
     */
    flow(files) {
        files = files || this._matchFiles.values();

        let allCached = true;

        const cacheFiles = files.map(file => {
            allCached = allCached && this._cacheFiles.has(file.filename);
            return this._cacheFiles.get(file.filename) || file;
        });

        if (allCached) {
            if (!this._transformer) {
                return Promise.resolve(cacheFiles).then(flattenDeep);
            } else if (this._transformer.isTorrential()) {
                return this._transformer.transformAll(cacheFiles);
            } else {
                return Promise.all(cacheFiles.map(file => this._transformer.transform(file))).then(flattenDeep);
            }
        }

        // Some files need to re-transformed

        let fs;
        if (this._parent) {
            fs = this._parent.flow(files).then(files => {
                // Cache
                files.forEach(file => this._cacheFiles.set(file.filename, extend({}, file)));
                return files;
            });
        } else {
            fs = Promise.resolve(cacheFiles);
        }

        if (this._transformer) {
            if (this._transformer.isTorrential()) {
                fs = fs.then(files => this._transformer.transformAll(files));
            } else {
                fs = fs.then(files => {
                    return Promise.all(files.map(file => this._transformer.transform(file)));
                });
            }
        }


        return fs.then(flattenDeep);
    }
    /**
     * Fire an end event.
     * 
     * @param  {string} tag  This tag for friendly log
     * @return {Stream} this
     */
    end(tag) {
        this.tag = tag;

        // The ended stream can have matches files
        defineFrozenProperty(this, '_matchFiles', new FileCollection());

        this.emit('end', this);
        return this;
    }
}

module.exports = Stream;