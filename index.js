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
     * Try to push the matched/cached files according to diffs.
     * 
     * @param  {object} diff
     * @param  {Boolean} force
     * @return {Boolean} If pushed
     */
    push(diff, force) {
        if ('change' === diff.cmd || 'remove' === diff.cmd) {
            this._cacheFiles.remove(diff.filename);
        }

        if (this._parent) {
            this._parent.push(diff, force);
        }

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
        const filesToFlow = files || this._matchFiles.values();

        let retPromise;

        const callParent = files => this._parent.flow(files);

        const flowInTorrential = files => this._transformer.transformAll(files);

        const flowOutOfTorrential = files => {
            return Promise.all(files.map(file => {
                if (this._cacheFiles.has(file.filename)) {
                    return Promise.resolve(this._cacheFiles.get(file.filename));
                } else {
                    return this._transformer.transform(file).then(tfile => {
                        if(tfile){
                            this._cacheFiles.set(file.filename, extend({}, tfile));
                        }
                        
                        return file;
                    });
                }
            }));
        };

        if (!this._transformer) {
            // Just pass through
            if (this._parent) {
                retPromise = callParent(filesToFlow);
            } else {
                retPromise = Promise.resolve(filesToFlow);
            }
        } else if (this._transformer.isTorrential()) {
            // In torrential mode, you cannot use cache
            if (this._parent) {
                retPromise = callParent(filesToFlow).then(flowInTorrential);
            } else {
                retPromise = flowInTorrential(filesToFlow);
            }
        } else {
            if (this._parent) {
                // Parent may be torrential, so you have
                // to flow all files instead of some.
                retPromise = callParent(filesToFlow).then(flowOutOfTorrential);
            } else {
                retPromise = flowOutOfTorrential(filesToFlow);
            }
        }

        return retPromise.then(flattenDeep);
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