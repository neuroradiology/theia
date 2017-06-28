/*
 * Copyright (C) 2017 Ericsson and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { LaunchBuild, LaunchBuildinfo /*, ILaunchResult*/ } from "./launch-build"
import * as chai from "chai";
import "mocha";
import * as chaiAsPromised from "chai-as-promised"
import { BuildUtils } from "./build-spec-utils";

chai.use(chaiAsPromised);
let expect = chai.expect;

// simulate build by having a JS file output simulated make output
// this way the test doesn't depend on platform/installed compiler.
let successfulBuild: LaunchBuildinfo = {
    cwd: __dirname + "/test-files/make/",
    buildCommand: "node",
    buildCommandArgs: ['gcc-make-success.js'],
    buildParser: "gcc-build-parser"
}
let failedBuild: LaunchBuildinfo = {
    cwd: __dirname + "/test-files/make/",
    buildCommand: "node",
    buildCommandArgs: ['gcc-make-failure.js'],
    buildParser: "gcc-build-parser"
}

describe("launch-build", () => {

    describe('launch make, build successful', () => {
        it('verify build executable launched, output captured', () => {
            let launch = new LaunchBuild()
            launch.launch(successfulBuild)

            let promise = BuildUtils.waitForBuildLogDone(launch)

            // tslint:disable-next-line:max-line-length
            return expect(promise).to.eventually.be.equal('Building file: ../src/hello.cpp\nInvoking: GCC C++ Compiler\ng++ -O0 -g3 -Wall -c -fmessage-length=0 -MMD -MP -MF"src/hello.d" -MT"src/hello.o" -o "src/hello.o" "../src/hello.cpp"\n../src/hello.cpp: In function ‘int main()’:\n../src/hello.cpp:16:6: warning: unused variable ‘i’ [-Wunused-variable]\n  int i = 42;\n      ^\nFinished building: ../src/hello.cpp\n \nBuilding target: hello\nInvoking: GCC C++ Linker\ng++  -o "hello"  ./src/hello.o   \nFinished building target: hello\n \n')
        })

        it('verify build reported as successful', () => {
            let launch = new LaunchBuild()
            let promise = launch.launch(successfulBuild)

            // tslint:disable-next-line:max-line-length
            return expect(promise).to.eventually.be.equal('success')
        })
    })

    describe('launch make, build failure', () => {

        it('verify build executable launched, output captured', () => {
            let launch = new LaunchBuild()
            launch.launch(failedBuild)

            let promise = BuildUtils.waitForBuildLogDone(launch)

            // tslint:disable-next-line:max-line-length
            return expect(promise).to.eventually.be.equal('Building file: ../src/hello.cpp\nInvoking: GCC C++ Compiler\ng++ -O0 -g3 -Wall -c -fmessage-length=0 -MMD -MP -MF"src/hello.d" -MT"src/hello.o" -o "src/hello.o" "../src/hello.cpp"\n../src/hello.cpp: In function ‘int main()’:\n../src/hello.cpp:21:9: error: ‘spatule’ was not declared in this scope\n  return spatule;\n         ^\n../src/hello.cpp:16:6: warning: unused variable ‘i’ [-Wunused-variable]\n  int i = 42;\n      ^\n../src/hello.cpp: In function ‘int get123()’:\n../src/hello.cpp:25:14: error: ‘s’ was not declared in this scope\n  int n = 123;s\n              ^\n../src/hello.cpp:25:6: warning: unused variable ‘n’ [-Wunused-variable]\n  int n = 123;s\n      ^\n../src/hello.cpp:27:1: warning: no return statement in function returning non-void [-Wreturn-type]\n }\n ^\nsrc/subdir.mk:18: recipe for target \'src/hello.o\' failed\nmake: *** [src/hello.o] Error 1\n')
        })

        it('verify build reported as failed', () => {
            let launch = new LaunchBuild()
            let promise = launch.launch(failedBuild)

            // tslint:disable-next-line:max-line-length
            return expect(promise).to.eventually.be.equal('failure')
        })

        it('verify build errors are emitted immediately as expected', () => {
            let launch = new LaunchBuild()
            launch.launch(failedBuild)

            let promise = BuildUtils.waitForNamedEventCount(launch, "build-error", 2)

            return expect(promise).to.eventually.be.deep.equal([
                {
                    "column": 9,
                    "endIndex": 321,
                    "filename": "../src/hello.cpp",
                    "line": 21,
                    "startIndex": 222,
                    "text": "../src/hello.cpp:21:9: error: ‘spatule’ was not declared in this scope\n  return spatule;\n         ^",
                    "type": "error"
                },
                {
                    "column": 14,
                    "endIndex": 559,
                    "filename": "../src/hello.cpp",
                    "line": 25,
                    "startIndex": 462,
                    "text": "../src/hello.cpp:25:14: error: ‘s’ was not declared in this scope\n  int n = 123;s\n              ^",
                    "type": "error"
                }
            ])
        })

        it('verify build warnings are emitted immediately as expected', () => {
            let launch = new LaunchBuild()
            launch.launch(failedBuild)

            let promise = BuildUtils.waitForNamedEventCount(launch, "build-warning", 3)

            return expect(promise).to.eventually.be.deep.equal([
                {
                    "column": 6,
                    "endIndex": 415,
                    "filename": "../src/hello.cpp",
                    "line": 16,
                    "startIndex": 322,
                    "text": "../src/hello.cpp:16:6: warning: unused variable ‘i’ [-Wunused-variable]\n  int i = 42;\n      ^",
                    "type": "warning"
                },
                {
                    "column": 6,
                    "endIndex": 655,
                    "filename": "../src/hello.cpp",
                    "line": 25,
                    "startIndex": 560,
                    "text": "../src/hello.cpp:25:6: warning: unused variable ‘n’ [-Wunused-variable]\n  int n = 123;s\n      ^",
                    "type": "warning"
                },
                {
                    "column": 1,
                    "endIndex": 760,
                    "filename": "../src/hello.cpp",
                    "line": 27,
                    "startIndex": 656,
                    "text": "../src/hello.cpp:27:1: warning: no return statement in function returning non-void [-Wreturn-type]\n }\n ^",
                    "type": "warning"
                }

            ])
        })

        it('verify build errors and warnings are emitted when build finished', () => {

            let launch = new LaunchBuild()
            launch.launch(failedBuild)

            let promise = BuildUtils.waitForNamedEvent(launch, "build_finished-errors-warnings")

            return expect(promise).to.eventually.be.deep.equal(
                {
                    entries: [
                        {
                            "column": 9,
                            "endIndex": 321,
                            "filename": "../src/hello.cpp",
                            "line": 21,
                            "startIndex": 222,
                            "text": "../src/hello.cpp:21:9: error: ‘spatule’ was not declared in this scope\n  return spatule;\n         ^",
                            "type": "error"
                        },
                        {
                            "column": 6,
                            "endIndex": 415,
                            "filename": "../src/hello.cpp",
                            "line": 16,
                            "startIndex": 322,
                            "text": "../src/hello.cpp:16:6: warning: unused variable ‘i’ [-Wunused-variable]\n  int i = 42;\n      ^",
                            "type": "warning"
                        },
                        {
                            "column": 14,
                            "endIndex": 559,
                            "filename": "../src/hello.cpp",
                            "line": 25,
                            "startIndex": 462,
                            "text": "../src/hello.cpp:25:14: error: ‘s’ was not declared in this scope\n  int n = 123;s\n              ^",
                            "type": "error"
                        },
                        {
                            "column": 6,
                            "endIndex": 655,
                            "filename": "../src/hello.cpp",
                            "line": 25,
                            "startIndex": 560,
                            "text": "../src/hello.cpp:25:6: warning: unused variable ‘n’ [-Wunused-variable]\n  int n = 123;s\n      ^",
                            "type": "warning"
                        },
                        {
                            "column": 1,
                            "endIndex": 760,
                            "filename": "../src/hello.cpp",
                            "line": 27,
                            "startIndex": 656,
                            "text": "../src/hello.cpp:27:1: warning: no return statement in function returning non-void [-Wreturn-type]\n }\n ^",
                            "type": "warning"
                        }
                    ],
                    "errors": 2,
                    "notes": 0,
                    "warnings": 3
                }
            )
        })

    })

})

