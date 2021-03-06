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
 * 2016-07-23[02:04:57]:children flow in defined order
 * 2016-07-29[18:07:01]:remove clearCache
 * 2016-07-30[09:13:29]:use cacheable of transformer
 * 2016-08-19[18:43:29]:fixed missing reset if transforming failed
 *
 * @author yanni4night@gmail.com
 * @version 0.7.8
 * @since 0.1.0
 */
'use strict';
const EventEmitter = require('events');
const {filter, flattenDeep, cloneDeep, isString, isNil} = require('lodash');
const defineFrozenProperty = require('define-frozen-property');
const FileContentCacher = require('./file-content-cacher');
const crypto = require('crypto');
/**
 * md5
 * 
 * @param  {Buffer|String} content
 * @return {String|Symbol}
 */
const digest = content => {
    if (isNil(content)) {
        return 0;
    }

    if (!isString(content) && !Buffer.isBuffer(content)) {
        return Symbol();
    }

    return crypto.createHash('md5').update(content).digest('hex');
};

let hash = 0x0810;

/** Class representing a stream. */
class PantoStream extends EventEmitter {
    constructor(transformer) {
        super();
        
        let _tag = `PantoStream#${hash++}`;

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

        defineFrozenProperty(this, '_cacheable', (transformer ? (transformer.isCacheable ? transformer.isCacheable() : false) :
            false));
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

        if(child.isConnectedWith(this)) {
            throw new Error(`${child.tag} has already connected with ${this.tag}`);
        }

        this._children.forEach(ch => {
            if (ch.child === child) {
                throw new Error(`${this.tag} connects to ${ch.tag} more than once`);
            }
        });

        child._parentsCount += 1;

        this._children.push({
            child,
            mergeFiles
        });

        return child;
    }
    /**
     * If connected with child.
     * 
     * @param  {PantoStream}  child
     * @return {Boolean} If connected
     */
    isConnectedWith(child) {
        for (let i = 0; i < this._children.length; ++i) {
            if (this._children[i].child === child) {
                return true;
            }
        }
        return false;
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
        return this.connect(new PantoStream(transformer), mergeFiles);
    }
    /**
     * Be notified that an ancestor has complete flowing.
     *
     * If all the ancestors are complete, just flow self.
     * 
     * @param  {Array} files Result of ancestor
     * @return {Promise} this flows
     */
    notify(files, clone) {
        if (clone) {
            this._filesToFlow.push(...cloneDeep(files));
        } else {
            this._filesToFlow.push(...files);
        }

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
     * To string
     * 
     * @return {String}
     */
    toString() {
        return this.tag.toString();
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

        const filesToFlow = files || this._filesToFlow;

        let retPromise;

        const flowInTorrential = files => this._transformer.transformAll(files);

        const flowOutOfTorrential = files => {
            return Promise.all(files.map(file => {
                const md5 = digest(file.content);
                
                if (this._cacheable && this._cacheFiles.has(md5)) {
                    return Promise.resolve(this._cacheFiles.get(md5));
                } else {
                    return this._transformer.transform(file).then(tfile => {
                        if (this._cacheable && tfile) {
                            this._cacheFiles.set(md5, cloneDeep(tfile));
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
            if (!this._children.length) {
                return files;
            }

            return new Promise((resolve, reject) => {
                let childIdx = 0;
                const results = [];
                
                const fn = () => {
                    if (childIdx === this._children.length) {
                        return resolve(results);
                    }

                    const {
                        child,
                        mergeFiles
                    } = this._children[childIdx];
                    //no transformer, no clone
                    child.notify((mergeFiles ? files : []), !!this._transformer).then(files => {
                        results.push(files);
                        fn();
                    }).catch(reject);
                    childIdx += 1;
                };
                fn();
            });

        }).then(flattenDeep);

        return ret.then(files => {
            // Automate reset
            this.reset();
            return files;
        }, err => {
            this.reset();
            throw err;
        });
    }
}

module.exports = PantoStream;
