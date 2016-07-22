/**
 * Copyright (C) 2016 pantojs.xyz
 * index.js
 *
 * changelog
 * 2016-07-05[23:15:32]:revised
 * 2016-07-11[09:26:00]:new flow
 * 2016-07-12[13:45:39]:remove merge
 * 2016-07-12[14:17:40]:compatible with old transformer
 * 2016-07-18[19:25:39]:new apis supporting topology
 * 2016-07-19[01:33:20]:use disk map
 * 2016-07-19[17:34:12]:add pipe
 * 2016-07-22[11:23:37]:clear cache if torrential
 *
 * @author yanni4night@gmail.com
 * @version 0.6.2
 * @since 0.1.0
 */
'use strict';
const EventEmitter = require('events');
const {filter, flattenDeep, cloneDeep, isString} = require('lodash');
const defineFrozenProperty = require('define-frozen-property');
const FileContentCacher = require('./file-content-cacher');

/** Class representing a stream. */
class PantoStream extends EventEmitter {
    constructor(transformer) {
        super();
        
        let _tag;

        const setTag = tag => {
            if (!isString(tag)) {
                throw new Error('"tag" should be a string');
            }
            _tag = tag;
            return this;
        };

        setTag.toString = () => _tag;

        Object.defineProperties(this, {
            '_parentsCount': {
                value: 0,
                configurable: false,
                enumerable: false,
                writable: true
            },
            '_isFrozen': {
                value: false,
                configurable: false,
                enumerable: false,
                writable: true
            },
            'tag': {
                get(){
                    return setTag;
                } 
            }
        });

        defineFrozenProperty(this, '_children', []);
        defineFrozenProperty(this, '_transformer', transformer);
        defineFrozenProperty(this, '_cacheFiles', new FileContentCacher());
        defineFrozenProperty(this, '_filesToFlow', []);
        defineFrozenProperty(this, '_dependencies', []);
    }
    /**
     * Treat "child" as a son descendant.
     * Use "connect" to build a network.
     * When a stream flows completly, it will
     * notify its children, give them the result
     * if requires.
     * 
     * @param  {PantoStream}  child
     * @param  {Boolean} mergeFiles If "child" need my result
     * @return {PantoStream} child
     */
    connect(child, mergeFiles = true) {
        if (!child || !(child instanceof PantoStream)) {
            throw new TypeError(`Should connect to an instance of PantoStream, not ${typeof child}`);
        }

        if(this._isFrozen || child._isFrozen) {
            throw new Error('Could not connect when frozen');
        }

        child._parentsCount += 1;
        this._children.push({
            child,
            mergeFiles
        });

        return child;
    }
    /**
     * Similar with connect, but receives transformer
     * instead of stream.
     * 
     * @param  {PantoTransformer}  transformer
     * @param  {Boolean} mergeFiles
     * @return {PantoStream}
     */
    pipe(transformer, mergeFiles = true) {
        return this.connect(new PantoStream(transformer),mergeFiles);
    }
    /**
     * Be notified that an ancestor has complete flowing.
     *
     * If all the ancestors are complete, just flow self.
     * 
     * @param  {...object} files Result of ancestor
     * @return {Promise} this flows
     */
    notify(...files) {
        this._filesToFlow.push(...files);
        this._parentsCount -= 1;
        if (this._parentsCount < 0) {
            this._parentsCount = 0;
        }
        return this.flow();
    }
    /**
     * Freeze self and all the descendants.
     * 
     * Stream cannot connect or be connected if frozen.
     * 
     * @return {PantoStream} this
     */
    freeze() {
        if (!('_parentsTotalCount' in this)) {
            defineFrozenProperty(this, '_parentsTotalCount', this._parentsCount);
        }
        this._children.forEach(({
            child
        }) => child.freeze());

        this._isFrozen = true;
        return this;
    }
    /**
     * Reset flowing status.
     * You do not need to call this.
     * 
     * @return {this}
     */
    reset() {
        this._filesToFlow.splice(0);
        this._parentsCount = this._parentsTotalCount;

        return this;
    }
    /**
     * Clear cache of some files.
     *
     * Cached files won't flow to non-torrential transformer.
     * 
     * @param  {...string} filenames
     * @return {PantoStream} this
     */
    clearCache(...filenames) {
        filenames.forEach(filename => this._cacheFiles.delete(filename));
        this._children.forEach(({
            child
        }) => child.clearCache(...filenames));

        return this;
    }
    /**
     * Flow files. Stream has to be frozen when flows.
     * 
     * @param  {Array} files
     * @return {Promise}
     */
    flow(files) {
        if (!this._isFrozen) {
            throw new Error(`Should be frozen before flowing`);
        }

        if (0 !== this._parentsCount) {
            return Promise.resolve([]);
        }
        // MUST IMMUTABLE
        const filesToFlow = cloneDeep(files || this._filesToFlow);

        let retPromise;

        const flowInTorrential = files => this._transformer.transformAll(files).then(files => {
            files.forEach(file => this.clearCache(file.filename));
            return files;
        });

        const flowOutOfTorrential = files => {
            return Promise.all(files.map(file => {
                if (this._cacheFiles.has(file.filename)) {
                    return Promise.resolve(this._cacheFiles.get(file.filename));
                } else {
                    return this._transformer.transform(file).then(tfile => {
                        if (tfile) {
                            this._cacheFiles.set(file.filename, cloneDeep(tfile));
                        }
                        return tfile;
                    });
                }
            }));
        };

        if (!this._transformer) {
            // Just pass through
            retPromise = Promise.resolve(filesToFlow);
        } else if (this._transformer.isTorrential && this._transformer.isTorrential()) {
            // In torrential mode, you cannot use cache
            retPromise = flowInTorrential(filesToFlow);
        } else {
            retPromise = flowOutOfTorrential(filesToFlow);
        }
        const ret = retPromise.then(filter).then(flattenDeep).then(files => {
            return this._children.length ? Promise.all(this._children.map(({
                child,
                mergeFiles
            }) => {
                if (mergeFiles) {
                    return child.notify(...files);
                } else {
                    return child.notify();
                }
            })) : files;
        }).then(flattenDeep);
        // Automate reset
        this.reset();

        return ret;
    }
}

module.exports = PantoStream;
