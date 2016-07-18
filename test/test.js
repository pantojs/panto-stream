/**
 * Copyright (C) 2016 pantojs.xyz
 * test.js
 *
 * changelog
 * 2016-07-05[23:18:22]:revised
 *
 * @author yanni4night@gmail.com
 * @version 0.6.0
 * @since 0.1.0
 */
'use strict';
const assert = require('assert');
const PantoStream = require('../');
const Transformer = require('panto-transformer');
const extend = require('lodash/extend');
require('panto');

/*global describe,it*/
/*eslint no-console: ["error", { allow: ["error"] }] */
describe('stream', () => {
    describe('#connect', () => {
        it('should throw error if connects a non-stream', done => {
            assert.throws(() => {
                new PantoStream().connect({});
            });
            done();
        });
        it('should throw error when frozen', done => {
            assert.throws(() => {
                new PantoStream().freeze().connect(new PantoStream());
            });
            done();
        });
        it('should return child', done => {
            const ps = new PantoStream();
            assert.deepEqual(ps, new PantoStream().connect(ps));
            done();
        });
    });
    describe('#notify', () => {
        it('should return self', done => {
            const ps = new PantoStream();
            ps.freeze();
            assert.ok(ps.notify() instanceof Promise);
            done();
        });
    });
    describe('#flow', () => {
        it('should merge to one by "connect"', done => {
            class TestTransformer extends Transformer {
                transformAll(files) {
                    assert.deepEqual(files, [{
                        filename: 'a.js'
                    }, {
                        filename: 'a.css'
                    }]);
                    return super.transformAll(files);
                }
                isTorrential() {
                    return true;
                }
            }

            const p1 = new PantoStream();
            const p2 = new PantoStream();
            const p3 = new PantoStream(new TestTransformer());
            p1.connect(p3);
            p2.connect(p3);
            p1.freeze();
            p2.freeze();
            p1.flow([{
                filename: 'a.js'
            }]).then(() => p2.flow([{
                filename: 'a.css'
            }])).then(() => done()).catch(e => console.error(e));

        });
        it('should cache when not torrential', done => {
            let invoked = 0;

            class TestTransformer extends Transformer {
                _transform(file) {
                    invoked += 1;
                    return super._transform(file);
                }
                isTorrential() {
                    return false;
                }
            }

            const p1 = new PantoStream();
            const p2 = new PantoStream(new TestTransformer());
            const p3 = new PantoStream();
            const p4 = new PantoStream();
            p1.connect(p2);
            p2.connect(p3);
            p2.connect(p4);
            p1.freeze();
            p1.flow([{
                filename: 'a.js'
            }]).then(() => {
                assert.deepEqual(invoked, 1);
            }).then(() => done()).catch(e => console.error(e));
        });
        it('should immutable', done => {
            const p1 = new PantoStream();
            const f = {
                filename: 'a.js'
            };
            p1.freeze();
            p1.notify(f).then(ft => {
                f.filename = 'b.js';
                assert.deepEqual(ft[0].filename, 'a.js');
            }).then(() => done()).catch(e => console.error(e));
        });
        it('should flow to the bottom', done => {
            let invoked = 0;

            class TestTransformer extends Transformer {
                _transform(file) {
                    invoked += 1;
                    return super._transform(file);
                }
                isTorrential() {
                    return false;
                }
            }

            const p1 = new PantoStream(new TestTransformer());
            const p2 = new PantoStream(new TestTransformer());
            const p3 = new PantoStream(new TestTransformer());
            const p4 = new PantoStream(new TestTransformer());
            p1.connect(p2).connect(p3).connect(p4);
            p1.freeze();
            p1.flow([{
                filename: 'a.js'
            }]).then(() => {
                assert.deepEqual(invoked, 4);
            }).then(() => done()).catch(e => console.error(e));
        });
        it('should ignore null', done => {
            class NilTransformer extends Transformer {
                _transform(file) {
                    if (file.content) {
                        return super._transform(file);
                    } else {
                        return Promise.resolve(null);
                    }
                }
            }
            new PantoStream(new NilTransformer()).freeze().flow([{
                filename: 'a.js'
            }]).then(files => {
                assert.deepEqual(files, [])
            }).then(() => done()).catch(e => console.error(e));
        });
        it('should not notify files if not mergeFile', done => {
            let invoked = 0;

            class TestTransformer extends Transformer {
                _transform(file) {
                    invoked += 1;
                    return super._transform(file);
                }
                isTorrential() {
                    return false;
                }
            }
            const p1 = new PantoStream();
            const p2 = new PantoStream(new TestTransformer());
            p1.connect(p2, false);
            p1.freeze();
            p1.flow([{
                filename: 'a.js'
            }]).then(files => {
                assert.deepEqual(files, []);
                assert.deepEqual(invoked, 0);
            }).then(() => done()).catch(e => console.error(e));
        });
        it(
            `
    0------►1------►2-------►3-----------
    |               |                   |
    |               |                   |
    |               |                   ▼
    |------►4------►5--------10--------►12
    |               |        ▲          ▲
    |               |        |          |
    |               6        |          |
    |               |        |          |
    |               |        |          |
    |------►8-------o-------►9          |
                    |        |          |
                    |        |          |
                    |        ▼          |
                    |-------►7---------►11
             `,
            done => {

                const flags = [];
                class TestTransformer extends Transformer {
                    transformAll(files) {
                        flags.push(this.options.flag);
                        return super.transformAll(files);
                    }
                    _transform(file) {
                        return Promise.resolve({
                            filename: file.filename,
                            content: file.content + ',' + this.options.flag
                        });
                    }
                    isTorrential() {
                        return true;
                    }
                }
                const p0 = new PantoStream(new TestTransformer({
                    flag: '0'
                }));
                const p1 = new PantoStream(new TestTransformer({
                    flag: '1'
                }));
                const p2 = new PantoStream(new TestTransformer({
                    flag: '2'
                }));
                const p3 = new PantoStream(new TestTransformer({
                    flag: '3'
                }));
                const p4 = new PantoStream(new TestTransformer({
                    flag: '4'
                }));
                const p5 = new PantoStream(new TestTransformer({
                    flag: '5'
                }));
                const p6 = new PantoStream(new TestTransformer({
                    flag: '6'
                }));
                const p7 = new PantoStream(new TestTransformer({
                    flag: '7'
                }));
                const p8 = new PantoStream(new TestTransformer({
                    flag: '8'
                }));
                const p9 = new PantoStream(new TestTransformer({
                    flag: '9'
                }));
                const p10 = new PantoStream(new TestTransformer({
                    flag: '10'
                }));
                const p11 = new PantoStream(new TestTransformer({
                    flag: '11'
                }));
                const p12 = new PantoStream(new TestTransformer({
                    flag: '12'
                }));

                p0.connect(p1).connect(p2).connect(p3).connect(p12);
                p0.connect(p4).connect(p5).connect(p10).connect(p12);
                p2.connect(p5).connect(p6).connect(p7).connect(p11).connect(p12);
                p0.connect(p8).connect(p9).connect(p10);
                p9.connect(p7, false);

                p0.freeze();
                p0.flow([{
                    filename: 'a.js',
                    content: ''
                }]).then(files => {
                    assert.deepEqual(files, [{
                        filename: 'a.js',
                        content: ',0,1,2,3,12'
                    }, {
                        filename: 'a.js',
                        content: ',0,8,9,10,12'
                    }, {
                        filename: 'a.js',
                        content: ',0,4,5,10,12'
                    }, {
                        filename: 'a.js',
                        content: ',0,1,2,5,10,12'
                    }, {
                        filename: 'a.js',
                        content: ',0,4,5,6,7,11,12'
                    }, {
                        filename: 'a.js',
                        content: ',0,1,2,5,6,7,11,12'
                    }]);
                    assert.deepEqual(flags, ['0', '1', '4', '8', '2', '9', '3', '5', '10',
                        '6', '7', '11', '12'
                    ]);
                }).then(() => done()).catch(e => console.error(e));
            });
    });
    describe('#reset', () => {
        it('should reset after flow', done => {
            const p1 = new PantoStream();

            p1.freeze();
            p1.notify({
                filename: 'a.js'
            }).then(files => {
                assert.deepEqual(files.length, 1);
                return p1.flow();
            }).then(files => {
                assert.deepEqual(files.length, 0);
                p1.reset();
                return p1.flow();
            }).then(files => {
                assert.deepEqual(files.length, 0);
            }).then(() => done()).catch(e => console.error(e));
        })
    });
    describe('#clearCache', () => {
        it('should cleard cache', done => {
            let invokedA = 0;
            let invokedB = 0;

            class TestTransformer extends Transformer {
                _transform(file) {
                    if ('a.js' === file.filename) {
                        invokedA += 1;
                    } else if ('b.js' === file.filename) {
                        invokedB += 1;
                    }
                    return super._transform(file);
                }
                isTorrential() {
                    return false;
                }
            }

            const p1 = new PantoStream();
            const p2 = new PantoStream(new TestTransformer());
            const p3 = new PantoStream();
            const p4 = new PantoStream();
            p1.connect(p2);
            p2.connect(p3);
            p2.connect(p4);
            p1.freeze();
            p1.flow([{
                filename: 'a.js'
            }, {
                filename: 'b.js'
            }]).then(() => {
                p1.reset().clearCache('a.js');
                return p1.flow([{
                    filename: 'a.js'
                }, {
                    filename: 'b.js'
                }]);
            }).then(() => {
                assert.deepEqual(invokedA, 2);
                assert.deepEqual(invokedB, 1);
            }).then(() => done()).catch(e => console.error(e));
        });
    });
});
