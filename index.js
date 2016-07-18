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
 *
 * @author yanni4night@gmail.com
 * @version 0.6.0
 * @since 0.1.0
 */
'use strict';
const EventEmitter = require('events');
const {
    filter,
    flattenDeep,
    cloneDeep
} = require('lodash');
const defineFrozenProperty = require('define-frozen-property');

/** Class representing a stream. */
class PantoStream extends EventEmitter {
    constructor(transformer) {
        super();
        this._parentsCount = 0;
        defineFrozenProperty(this, '_children', []);
        defineFrozenProperty(this, '_transformer', transformer);
        defineFrozenProperty(this, '_cacheFiles', new Map());
        defineFrozenProperty(this, '_filesToFlow', []);
        defineFrozenProperty(this, '_dependencies', []);
    }
    connect(child, mergeFiles = true) {
        if (!child || !(child instanceof PantoStream)) {
            throw new TypeError(`Should connect to an instance of PantoStream, not ${typeof child}`);
        }
        child._parentsCount += 1;
        this._children.push({
            child,
            mergeFiles
        });

        return child;
    }
    notify(...files) {
        this._filesToFlow.push(...files);
        this._parentsCount -= 1;
        if (this._parentsCount < 0) {
            this._parentsCount = 0;
        }
        return this.flow();

    }
    freeze() {
        if (!('_parentsTotalCount' in this)) {
            defineFrozenProperty(this, '_parentsTotalCount', this._parentsCount);
        }
        this._children.forEach(({
            child
        }) => child.freeze());
        return this;
    }
    reset() {
        this._filesToFlow.splice(0);
        this._parentsCount = this._parentsTotalCount;

        return this;

    }
    clearCache(...filenames) {
        filenames.forEach(filename => this._cacheFiles.delete(filename));
        this._children.forEach(({
            child
        }) => child.clearCache(...filenames));

        return this;
    }
    flow(files) {

        if (0 !== this._parentsCount) {
            return Promise.resolve([]);
        }

        const filesToFlow = cloneDeep(files || this._filesToFlow);

        let retPromise;

        const flowInTorrential = files => this._transformer.transformAll(files);

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

        this.reset();

        return ret;
    }
}

module.exports = PantoStream;
