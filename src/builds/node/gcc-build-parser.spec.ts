/*
 * Copyright (C) 2017 Ericsson and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { GccBuildParser } from "./gcc-build-parser";
import * as Stream from "stream";
import * as fs from 'fs'
import * as chai from "chai";
import "mocha";
import * as chaiAsPromised from "chai-as-promised"
import { BuildUtils } from "./build-spec-utils";

chai.use(chaiAsPromised);
let expect = chai.expect;

describe("gcc-build-parser", () => {

    describe('parse simple gcc error log', () => {

        it('verify errors, warning, note are found', () => {
            let logName: String = '/test-files/' + 'error.txt'
            let parser: GccBuildParser
            let readStream: NodeJS.ReadableStream

            readStream = fs.createReadStream(__dirname + logName)
            parser = new GccBuildParser(readStream)

            let promise = parser.parse()

            return expect(promise).to.eventually.deep.equal(
                {
                    entries: [{
                        "column": 4,
                        "endIndex": 797,
                        "filename": "./regex.c",
                        "line": 280,
                        "startIndex": 704,
                        "type": "error",
                        text: './regex.c:280:4: error: ‘spatule’ undeclared (first use in this function)\n    spatule++\n    ^'
                    },
                    {
                        "column": 4,
                        "endIndex": 982,
                        "filename": "./regex.c",
                        "line": 281,
                        "startIndex": 902,
                        "type": "error",
                        text: './regex.c:281:4: error: expected ‘;’ before ‘register’\n    register int c;\n    ^'
                    },
                    {
                        "column": 9,
                        "endIndex": 1101,
                        "filename": "./regex.c",
                        "line": 288,
                        "startIndex": 983,
                        "type": "error",
                        text: './regex.c:288:9: error: ‘c’ undeclared (first use in this function)\n    for (c = 0; c < CHAR_SET_SIZE; ++c)\n         ^'
                    },
                    {
                        "column": 8,
                        "endIndex": 1585,
                        "filename": "./regex.c",
                        "line": 282,
                        "startIndex": 1483,
                        "text": "./regex.c:282:8: warning: unused variable ‘spatule’ [-Wunused-variable]\n    int spatule = 0;\n        ^",
                        "type": "warning"
                    },
                    {
                        "column": 54,
                        "endIndex": 1887,
                        "filename": "./../include/libiberty.h",
                        "line": 357,
                        "startIndex": 1701,
                        // tslint:disable-next-line:max-line-length
                        "text": "./../include/libiberty.h:357:54: note: in definition of macro ‘XNEWVEC’\n #define XNEWVEC(T, N)  ((T *) xmalloc (sizeof (T) * (N)))\n                                                      ^",
                        "type": "note"
                    }
                    ],
                    errors: 3,
                    warnings: 1,
                    notes: 1,
                })

        })
    })

    describe('parse large gcc build log', () => {

        it('verify error is found', () => {
            let logName: String = '/test-files/' + 'largeOutput.txt'
            let parser: GccBuildParser
            let readStream: NodeJS.ReadableStream

            readStream = fs.createReadStream(__dirname + logName)
            parser = new GccBuildParser(readStream)

            let promise = parser.parse()

            return expect(promise).to.eventually.deep.equal(
                {
                    entries: [{
                        "column": 22,
                        "endIndex": 486011,
                        "filename": "remote-utils.c",
                        "line": 1455,
                        "startIndex": 485898,
                        "type": "error",
                        text: 'remote-utils.c:1455:22: error: ‘p’ was not declared in this scope\n   *symcache_p = NULL;p\n                      ^'
                    }
                    ],
                    errors: 1,
                    warnings: 0,
                    notes: 0,
                })

        })
    })

    describe('parse entries that overlap consecutive data chunks', () => {
        let parser: GccBuildParser
        let inStream: Stream.Readable

        // Feed the parser with 3 errors,split so that parsing would fail
        // to see all of them if the chunks were just considered one-by-one

        // tslint:disable-next-line:max-line-length
        let firstChunk = "make[1]: Entering directory '/tmp/gdb-8.0'\nmake[2]: Entering directory '/tmp/gdb-8.0/libiberty'\nif [ x\"\" != x ]; then \\n  gcc -c -DHAVE_CONFIG_H -g -O2  -I. -I./../include  -W -Wall -Wwrite-strings -Wc++-compat -Wstrict-prototypes -pedantic  -D_GNU_SOURCE  ./regex.c -o pic/regex.o; \\nelse true; fi\nif [ x\"\" != x ]; then \\n  gcc -c -DHAVE_CONFIG_H -g -O2  -I. -I./../include  -W -Wall -Wwrite-strings -Wc++-compat -Wstrict-prototypes -pedantic  -D_GNU_SOURCE   ./regex.c -o noasan/regex.o; \\nelse true; fi\ngcc -c -DHAVE_CONFIG_H -g -O2  -I. -I./../include  -W -Wall -Wwrite-strings -Wc++-compat -Wstrict-prototypes -pedantic  -D_GNU_SOURCE ./regex.c -o regex.o\n./regex.c: In function ‘init_syntax_once’:\n./regex.c:280:4: error: ‘spatule’ undeclared (first use in this function)\n    spatul"
        let secondChunk = 'e++\n    ^\n./regex.c:280:4: note: each undeclared identifier is reported only once for each function it appears in\n./regex.c'
        // tslint:disable-next-line:max-line-length
        let thirdChunk = ":281:4: error: expected ‘;’ before ‘register’\n    register int c;\n    ^\n./regex.c:288:9: error: ‘c’ undeclared (first use in this function)\n    for (c = 0; c < CHAR_SET_SIZE; ++c)\n         ^\nMakefile:1167: recipe for target 'regex.o' failed\nmake[2]: *** [regex.o] Error 1\nmake[2]: Leaving directory '/tmp/ gdb - 8.0 / libiberty'\nMakefile:7040: recipe for target 'all- libiberty' failed\nmake[1]: *** [all-libiberty] Error 2\nmake[1]: Leaving directory '/ tmp / gdb - 8.0'\nMakefile:849: recipe for target 'all' failed\nmake: *** [all] Error 2"

        beforeEach(() => {
            inStream = new Stream.Readable
            inStream.push(firstChunk)
            inStream.push(secondChunk)
            inStream.push(thirdChunk)
            inStream.push(null)
        })

        it('verify all errors are found', () => {
            parser = new GccBuildParser(inStream, 200)
            let promise = parser.parse()

            return expect(promise).to.eventually.deep.equal(
                {
                    entries: [{
                        "column": 4,
                        "endIndex": 797,
                        "filename": "./regex.c",
                        "line": 280,
                        "startIndex": 704,
                        "type": "error",
                        text: './regex.c:280:4: error: ‘spatule’ undeclared (first use in this function)\n    spatule++\n    ^'
                    },
                    {
                        "column": 4,
                        "endIndex": 982,
                        "filename": "./regex.c",
                        "line": 281,
                        "startIndex": 902,
                        "type": "error",
                        text: './regex.c:281:4: error: expected ‘;’ before ‘register’\n    register int c;\n    ^'
                    },
                    {
                        "column": 9,
                        "endIndex": 1101,
                        "filename": "./regex.c",
                        "line": 288,
                        "startIndex": 983,
                        "type": "error",
                        text: './regex.c:288:9: error: ‘c’ undeclared (first use in this function)\n    for (c = 0; c < CHAR_SET_SIZE; ++c)\n         ^'
                    }
                    ],
                    errors: 3,
                    warnings: 0,
                    notes: 0,
                })
        })

        it('verify duplicated errors are filtered-out', () => {
            // cause duplication by increasing the size of "chunk overlap"
            parser = new GccBuildParser(inStream, 350)
            let promise = parser.parse()

            return expect(promise).to.eventually.deep.equal(
                {
                    entries: [{
                        "column": 4,
                        "endIndex": 797,
                        "filename": "./regex.c",
                        "line": 280,
                        "startIndex": 704,
                        "type": "error",
                        text: './regex.c:280:4: error: ‘spatule’ undeclared (first use in this function)\n    spatule++\n    ^'
                    },
                    {
                        "column": 4,
                        "endIndex": 982,
                        "filename": "./regex.c",
                        "line": 281,
                        "startIndex": 902,
                        "type": "error",
                        text: './regex.c:281:4: error: expected ‘;’ before ‘register’\n    register int c;\n    ^'
                    },
                    {
                        "column": 9,
                        "endIndex": 1101,
                        "filename": "./regex.c",
                        "line": 288,
                        "startIndex": 983,
                        "type": "error",
                        text: './regex.c:288:9: error: ‘c’ undeclared (first use in this function)\n    for (c = 0; c < CHAR_SET_SIZE; ++c)\n         ^'
                    }
                    ],
                    errors: 3,
                    warnings: 0,
                    notes: 0,
                })
        })
    })

    describe('parse gcc build log, catch entries as they are parsed', () => {
        let logName: String = '/test-files/' + 'error.txt'
        let parser: GccBuildParser
        let readStream: NodeJS.ReadableStream

        beforeEach(() => {
            readStream = fs.createReadStream(__dirname + logName)
            parser = new GccBuildParser(readStream)
        })

        it('verify entries are emitted as they are parsed', () => {
            parser.parse()

            // we expect 5 errors/warnings/notes to be found
            let promise = BuildUtils.waitForNamedEventCount(parser, 'new-entry', 5);
            // let promise_stats = BuildUtils.waitForNamedEvent(parser, 'stats')

            return expect(promise).to.eventually.be.deep.equal(
                [
                    {
                        "column": 4,
                        "endIndex": 797,
                        "filename": "./regex.c",
                        "line": 280,
                        "startIndex": 704,
                        "type": "error",
                        text: './regex.c:280:4: error: ‘spatule’ undeclared (first use in this function)\n    spatule++\n    ^'
                    },
                    {
                        "column": 4,
                        "endIndex": 982,
                        "filename": "./regex.c",
                        "line": 281,
                        "startIndex": 902,
                        "type": "error",
                        text: './regex.c:281:4: error: expected ‘;’ before ‘register’\n    register int c;\n    ^'
                    },
                    {
                        "column": 9,
                        "endIndex": 1101,
                        "filename": "./regex.c",
                        "line": 288,
                        "startIndex": 983,
                        "type": "error",
                        text: './regex.c:288:9: error: ‘c’ undeclared (first use in this function)\n    for (c = 0; c < CHAR_SET_SIZE; ++c)\n         ^'
                    },
                    {
                        "column": 8,
                        "endIndex": 1585,
                        "filename": "./regex.c",
                        "line": 282,
                        "startIndex": 1483,
                        "text": "./regex.c:282:8: warning: unused variable ‘spatule’ [-Wunused-variable]\n    int spatule = 0;\n        ^",
                        "type": "warning"
                    },
                    {
                        "column": 54,
                        "endIndex": 1887,
                        "filename": "./../include/libiberty.h",
                        "line": 357,
                        "startIndex": 1701,
                        // tslint:disable-next-line:max-line-length
                        "text": "./../include/libiberty.h:357:54: note: in definition of macro ‘XNEWVEC’\n #define XNEWVEC(T, N)  ((T *) xmalloc (sizeof (T) * (N)))\n                                                      ^",
                        "type": "note"
                    }
                ]
            );

        })

        it('verify stats are emitted after parsing is done', () => {
            parser.parse()

            let promise = BuildUtils.waitForNamedEvent(parser, 'done')

            return expect(promise).to.eventually.be.deep.equal(
                {
                    errors: 3,
                    warnings: 1,
                    notes: 1,
                }
            );

        })

    })

})

