/**
 * Copyright (C) 2016 pantojs.xyz
 * file-collection.js
 *
 * changelog
 * 2016-07-05[23:15:38]:revised
 *
 * @author yanni4night@gmail.com
 * @version 0.1.0
 * @since 0.1.0
 */
'use strict';

const {values, extend} = require('lodash');
const defineFrozenProperty = require('define-frozen-property');

/** Class representing a file collection. */
class FileCollection {
    constructor(...filenames) {
        defineFrozenProperty(this, '_fileObjects', {});

        filenames.forEach(filename => {
            this._fileObjects[filename] = {
                filename
            };
        });
    }
    /**
     * Copy all the files from a file collection.
     * 
     * @param  {FileCollection} fileCollection
     * @return {FileCollection} this
     */
    wrap(fileCollection) {
        extend(this._fileObjects, fileCollection._fileObjects);
        return this;
    }
    /**
     * If has a file by filename.
     * 
     * @param  {string}  filename
     * @return {Boolean} If has it
     */
    has(filename) {
        return filename in this._fileObjects;
    }
    /**
     * Get a file by filename.
     * 
     * @param  {string} filename
     * @return {object} file
     */
    get(filename) {
        return this._fileObjects[filename];
    }
    /**
     * Add a file if has not or be forced.
     * 
     * @param  {object} file
     * @param  {Boolean} force
     * @return {FileCollection} this
     */
    add(file, force) {
        const {_fileObjects} = this;

        if (file && (force || !(file.filename in _fileObjects))) {
            _fileObjects[file.filename] = file;
        }
        return this;
    }
    /**
     * Remove a file.
     * 
     * @param  {string} filename
     * @return {FileCollection} this
     */
    remove(filename) {
        delete this._fileObjects[filename];
        return this;
    }
    /**
     * Truncate a file.
     * 
     * @param  {string} filename
     * @return {FileCollection} this
     */
    refresh(filename) {
        const file = this._fileObjects[filename];
        if (file) {
            file.content = null;
        }
        return this;
    }
    /**
     * Get files as an array.
     * 
     * @return {array}
     */
    values() {
        return values(this._fileObjects);
    }
    /**
     * Update one file at most according to diff.
     * 
     * @param  {object} diff Diff object like {cmd:'change',filename:'a.js'}
     * @return {FileCollection} this
     */
    update(diff) {
        switch (diff.cmd) {
        case 'add':
            this.add({
                filename: diff.filename,
                content: diff.content
            });
            break;
        case 'change':
            this.refresh(diff.filename);
            break;
        case 'remove':
            this.remove(diff.filename);
            break;
        default:
            throw new Error(`"${diff.cmd}" is not supported when update a file collection`);
        }
        return this;
    }
}

module.exports = FileCollection;