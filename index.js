/**
 * Copyright (C) 2016 pantojs.xyz
 * index.js
 *
 * changelog
 * 2016-07-05[23:15:32]:revised
 * 2016-07-11[09:26:00]:new flow
 *
 * @author yanni4night@gmail.com
 * @version 0.4.0
 * @since 0.1.0
 */
'use strict';
const minimatch = require('minimatch');
const FileCollection = require('./file-collection');
const EventEmitter = require('events');
const {flattenDeep, cloneDeep, isString, filter, isNil} = require('lodash');
const defineFrozenProperty = require('define-frozen-property');

/** Class representing a stream. */
class Stream extends EventEmitter {
    constructor(transformer, pattern) {
        super();
        if (!isString(pattern) && !isNil(pattern)) {
            throw new Error(`"pattern" has to be a string or null/undefined, but it's ${typeof pattern}`);
        }
        defineFrozenProperty(this, '_children', []); // Children should be piped in
        defineFrozenProperty(this, '_pattern', pattern);
        defineFrozenProperty(this, '_transformer', transformer);
        defineFrozenProperty(this, '_cacheFiles', new Map());
        if (pattern || null === pattern) {
            defineFrozenProperty(this, '_matchFiles', new FileCollection());
        }
        this.tag = '';
    }
    /**
     * Create a new child stream with transformer.
     *
     * 
     * @param  {Transformer} transformer
     * @return {Stream} The new stream
     */
    pipe(transformer) {
        const child = new Stream(transformer);
        this._children.push(child);
        return child;
    }
    /**
     * @param  {...Stream}
     * @return {Stream}
     */
    merge(...streams) {
        const parents = [this, ...streams];
        const child = new Stream();
        parents.forEach(parent => parent._children.push(child));
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
     * Try to push the matched/cached files according to diffs.
     * 
     * @param  {object} diff
     * @param  {Boolean} force
     * @return {Boolean} If pushed
     */
    push(diff, force) {
        if ('change' === diff.cmd || 'remove' === diff.cmd) {
            this._cacheFiles.delete(diff.filename);
        }

        this._children.forEach(child => child.push(diff, force));

        if (this._matchFiles && (force || (this._pattern && minimatch(diff.filename, this._pattern)))) {
            // clear content
            this._matchFiles.update(diff);

            return true;
        }
        return false;

    }
    /**
     * Flow the files, if has parent, parent flows first,
     * if files is undefined, flows matched files instead.
     * 
     * @param  {Array|undefined} files 
     * @return {Promise}
     */
    flow(files) {
        const filesToFlow = files || this._matchFiles.values();// Only the topest streams have matched files

        let retPromise;

        const callChildren = files => Promise.all(this._children.map(child => child.flow(files))).then(flattenDeep).then(filter);

        const flowInTorrential = files => this._transformer.transformAll(files);

        const flowOutOfTorrential = files => {
            return Promise.all(files.map(file => {
                if (this._cacheFiles.has(file.filename)) {
                    return Promise.resolve(this._cacheFiles.get(file.filename));
                } else {
                    return this._transformer.transform(file).then(tfile => {
                        if(tfile){
                            this._cacheFiles.set(file.filename, cloneDeep(tfile));
                        }
                        return tfile;
                    });
                }
            }));
        };

        if (!this._transformer) {
            // Just pass through
            if (this._children.length) {
                retPromise = callChildren(filesToFlow);
            } else {
                retPromise = Promise.resolve(filesToFlow);
            }
        } else if (this._transformer.isTorrential()) {
            // In torrential mode, you cannot use cache
            if (this._children.length) {
                retPromise = flowInTorrential(filesToFlow).then(flattenDeep).then(filter).then(callChildren);
            } else {
                retPromise = flowInTorrential(filesToFlow);
            }
        } else {
            if (this._children.length) {
                // Parent may be torrential, so you have
                // to flow all files instead of some.
                retPromise = flowOutOfTorrential(filesToFlow).then(flattenDeep).then(filter).then(callChildren);
            } else {
                retPromise = flowOutOfTorrential(filesToFlow);
            }
        }

        return retPromise.then(flattenDeep);
    }
}

module.exports = Stream;
