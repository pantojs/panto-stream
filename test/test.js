/**
 * Copyright (C) 2016 pantojs.xyz
 * test.js
 *
 * changelog
 * 2016-07-05[23:18:22]:revised
 *
 * @author yanni4night@gmail.com
 * @version 0.2.0
 * @since 0.1.0
 */
'use strict';
const assert = require('assert');
const Stream = require('../');
const Transformer = require('panto-transformer');
const extend = require('lodash/extend');
require('panto');

/*global describe,it*/
/*eslint no-console: ["error", { allow: ["error"] }] */

describe('stream', () => {
    describe('#pipe', () => {
        it('should get another stream returned', () => {
            const s = new Stream();
            const rs = s.pipe(new Transformer());
            assert.ok(s !== rs, 'new object');
            assert.ok(rs instanceof Stream, 'new stream');
        });

        it('bubble up "end" event', done => {
            const s = new Stream();
            const rs = s.pipe(new Transformer()).pipe(new Transformer());
            s.on('end', () => {
                done();
            });
            rs.end('tag');
        });
    });

    describe('#flow', () => {
        it('has parent and torrential--no cache,parent flows', done => {
            let parentInvoked = 0;
            let childInvoked = 0;

            class ParentTransformer extends Transformer {
                _transform(file) {
                    parentInvoked += 1;
                    return Promise.resolve(extend(file, {
                        content: file.content + '-parent'
                    }));
                }
                isTorrential() {
                    return false;
                }
            }

            class ChildTransformer extends Transformer {
                transformAll(files) {
                    childInvoked += 1;
                    return super.transformAll(files);
                }
                _transform(file) {
                    return Promise.resolve(extend(file, {
                        content: file.content + '-child'
                    }));
                }
                isTorrential() {
                    return true;
                }
            }

            const parent = new Stream(null, null, new ParentTransformer());
            const child = new Stream(parent, null, new ChildTransformer());

            child.flow([{
                filename: 'a.js',
                content: 'content'
            }, {
                filename: 'b.js',
                content: 'content'
            }]).then(files => {
                assert.deepEqual(files, [{
                    filename: 'a.js',
                    content: 'content-parent-child'
                }, {
                    filename: 'b.js',
                    content: 'content-parent-child'
                }]);
                return child.flow(files);
            }).then(files => child.flow(files)).then(files => {
                assert.deepEqual(parentInvoked, files.length,
                    'untorrential parent tranforms files count times bacause of cache'
                );
                assert.deepEqual(childInvoked, 3,
                    'torrential child transformAll flowing times');
            }).then(() => done()).catch(e => console.error(e));

        });
        it('has parent and not torrential--cached,parent flows;', done => {
            let parentInvoked = 0;
            let childInvoked = 0;

            class ParentTransformer extends Transformer {
                _transform(file) {
                    parentInvoked += 1;
                    return Promise.resolve(extend(file, {
                        content: file.content + '-parent'
                    }));
                }
                isTorrential() {
                    return false;
                }
            }

            class ChildTransformer extends Transformer {
                _transform(file) {
                    childInvoked += 1;
                    return Promise.resolve(extend(file, {
                        content: file.content + '-child'
                    }));
                }
                isTorrential() {
                    return false;
                }
            }

            const parent = new Stream(null, null, new ParentTransformer());
            const child = new Stream(parent, null, new ChildTransformer());

            child.flow([{
                filename: 'a.js',
                content: 'content'
            }, {
                filename: 'b.js',
                content: 'content'
            }]).then(files => {
                assert.deepEqual(files, [{
                    filename: 'a.js',
                    content: 'content-parent-child'
                }, {
                    filename: 'b.js',
                    content: 'content-parent-child'
                }]);
                return child.flow(files);
            }).then(files => child.flow(files)).then(files => {
                assert.deepEqual(parentInvoked, files.length,
                    'untorrential parent tranforms files count times bacause of cache'
                );
                assert.deepEqual(childInvoked, files.length,
                    'torrential child tranforms files count times bacause of cache'
                );
            }).then(() => done()).catch(e => console.error(e));
        });
        it('has no parent and torrential--no cache', done => {
            let childInvoked = 0;

            class ChildTransformer extends Transformer {
                transformAll(files) {
                    childInvoked += 1;
                    return super.transformAll(files);
                }
                _transform(file) {
                    return Promise.resolve(extend(file, {
                        content: file.content + '-child'
                    }));
                }
                isTorrential() {
                    return true;
                }
            }

            const child = new Stream(null, null, new ChildTransformer());

            child.flow([{
                filename: 'a.js',
                content: 'content'
            }, {
                filename: 'b.js',
                content: 'content'
            }]).then(files => {
                assert.deepEqual(files, [{
                    filename: 'a.js',
                    content: 'content-child'
                }, {
                    filename: 'b.js',
                    content: 'content-child'
                }]);
                return child.flow(files);
            }).then(files => child.flow(files)).then(files => {
                assert.deepEqual(childInvoked, 3,
                    'torrential child transformAll flowing times');
            }).then(() => done()).catch(e => console.error(e));
        });
        it('has no parent and not torrential--cached', done => {
            let childInvoked = 0;

            class ChildTransformer extends Transformer {
                _transform(file) {
                    childInvoked += 1;
                    return Promise.resolve(extend(file, {
                        content: file.content + '-child'
                    }));
                }
                isTorrential() {
                    return false;
                }
            }

            const child = new Stream(null, null, new ChildTransformer());

            child.flow([{
                filename: 'a.js',
                content: 'content'
            }, {
                filename: 'b.js',
                content: 'content'
            }]).then(files => {
                assert.deepEqual(files, [{
                    filename: 'a.js',
                    content: 'content-child'
                }, {
                    filename: 'b.js',
                    content: 'content-child'
                }]);
                return child.flow(files);
            }).then(files => child.flow(files)).then(files => {
                assert.deepEqual(childInvoked, files.length,
                    'torrential child tranforms files count times bacause of cache'
                );
            }).then(() => done()).catch(e => console.error(e));
        });
        it('has parent and no transformer--through', done => {
            let parentInvoked = 0;
            class ParentTransformer extends Transformer {
                transformAll(files) {
                    parentInvoked += 1;
                    return super.transformAll(files);
                }
                isTorrential() {
                    return true;
                }
            }
            const parent = new Stream(null, null, new ParentTransformer());
            const child = new Stream(parent, null);
            const files = [{
                filename: 'a.js',
                content: 'content'
            }, {
                filename: 'b.js',
                content: 'content'
            }];
            child.flow(files).then(tfiles => {
                assert.deepEqual(parentInvoked, 1);
                assert.deepEqual(tfiles, files);
            }).then(() => done()).catch(e => console.error(e));
        })
    });

    describe('#push', () => {
        it('push could force even file not matched', done => {
            const s = new Stream(null, '*.css').end();
            const file = {
                cmd: 'add',
                filename: 'a.js'
            };
            s.push(file);
            s.flow().then(files => {
                assert.deepEqual(files, [], 'file not match cannot push');
            }).then(() => {
                s.push(file, true);
                return s.flow();
            }).then(files => {
                assert.deepEqual(files, [{
                    filename: 'a.js',
                    content: undefined
                }], 'file pushed if force');
            }).then(() => {
                done();
            }).catch(e => console.error(e));

        });
        it('could clear cache', done => {
            let invoked = 0;
            class TestTransformer extends Transformer {
                _transform(file) {
                    invoked += 1;
                    return super._transform(file);
                }
            }
            const s = new Stream(null, null, new TestTransformer());
            s.flow([{
                filename: 'a.js',
                content: 'content'
            }, {
                filename: 'b.js',
                content: 'content'
            }]).then(files => {
                assert.deepEqual(invoked, 2, 'one time');
                return s.flow(files);
            }).then(files => {
                assert.deepEqual(invoked, 2, 'still one time dut to cache');
                s.push({
                    filename: 'a.js',
                    cmd: 'remove'
                });
                return s.flow(files);
            }).then(() => {
                assert.deepEqual(invoked, 3, 'two times due to cache cleared');
                done();
            }).catch(e => console.error(e));;
        });

        it('push to parent', done => {
            let parentInvoked = 0;
            let childInvoked = 0;

            class ParentTransformer extends Transformer {
                _transform(file) {
                    parentInvoked += 1;
                    return Promise.resolve(extend(file, {
                        content: file.content + '-parent'
                    }));
                }
                isTorrential() {
                    return false;
                }
            }

            class ChildTransformer extends Transformer {
                transformAll(files) {
                    childInvoked += 1;
                    return super.transformAll(files);
                }
                _transform(file) {
                    return Promise.resolve(extend(file, {
                        content: file.content + '-child'
                    }));
                }
                isTorrential() {
                    return true;
                }
            }

            const parent = new Stream(null, null, new ParentTransformer());
            const child = new Stream(parent, '*.js', new ChildTransformer()).end('child');

            child.push({
                cmd: 'add',
                filename: 'a.js',
                content: 'content'
            });
            child.push({
                cmd: 'add',
                filename: 'b.js',
                content: 'content'
            });

            child.flow().then(files => {
                assert.deepEqual(files, [{
                    filename: 'a.js',
                    content: 'content-parent-child'
                }, {
                    filename: 'b.js',
                    content: 'content-parent-child'
                }]);
                child.push({
                    filename: 'a.js',
                    cmd: 'remove'
                });
                return child.flow();
            }).then(files => {
                assert.deepEqual(files, [{
                    filename: 'b.js',
                    content: 'content-parent-child'
                }], 'a.js is removed');
                assert.deepEqual(parentInvoked, 2,
                    'untorrential parent tranforms two times due to cache'
                );
                assert.deepEqual(childInvoked, 2,
                    'torrential child transformAll flowing times');
                child.push({
                    filename: 'b.js',
                    cmd: 'change'
                });
                return child.flow();
            }).then(() => {
                assert.deepEqual(parentInvoked, 3,
                    'untorrential parent tranforms two times due to cache'
                );
                assert.deepEqual(childInvoked, 3,
                    'torrential child transformAll flowing times');
            }).then(() => done()).catch(e => console.error(e));

        });
    });
    describe('#isRest', () => {
        it('should return true if pattern is null', () => {
            const s = new Stream(null, null);
            assert.ok(s.isRest());
        });
        it('should return false if pattern is undefined/NaN/""', () => {
            let s = new Stream(null, undefined);
            assert.ok(!s.isRest());
            s = new Stream(null, NaN);
            assert.ok(!s.isRest());
            s = new Stream(null, "");
            assert.ok(!s.isRest());
        });
    });
    describe('#end', () => {
        it('should set the tag', () => {
            const s = new Stream();
            s.end('kate');
            assert.deepEqual(s.tag, 'kate');
        });
        it('should emit "end" event', done => {
            const s = new Stream();
            s.on('end', () => {
                done();
            });
            s.end();
        });
        it('should emit "end" event to th ancestor', done => {
            const s = new Stream(null, '', new Transformer());
            const last = s.pipe(new Transformer()).pipe(new Transformer());
            s.on('end', leaf => {
                assert.deepEqual(leaf, last);
                done();
            });
            last.end();
        });
    });
});