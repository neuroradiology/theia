import { IBuildOutputParsedEntry } from './build-parser';
import { GccBuildParser } from './gcc-build-parser';
import * as Events from "events"
import * as child from 'child_process';


export interface LaunchBuildinfo {
    /** the directory where to execute the build */
    cwd: string
    /** build executable or script to call */
    buildCommand: string,
    /** arguments to pass to build executable/script */
    buildCommandArgs?: any[], // e.g. "all", clean", etc
    /** Which parser to use */
    buildParser: string
}

export interface ILaunchBuild {
    launch(launchinfo: LaunchBuildinfo): Promise<string>
}

export interface ILaunchResult {
    stdout: NodeJS.ReadableStream,
    stderr: NodeJS.ReadableStream
}

export class LaunchBuild extends Events.EventEmitter implements ILaunchBuild {

    public launch(launchinfo: LaunchBuildinfo): Promise<string> {
        let build: child.ChildProcess

        return new Promise((resolve, reject) => {
            build = child.spawn(launchinfo.buildCommand, launchinfo.buildCommandArgs || [], { cwd: launchinfo.cwd })

            let parser: GccBuildParser = new GccBuildParser(build.stderr)

            parser.parse().then((res) => {
                // build done - emit the final parsed build output
                this.emit('build_finished-errors-warnings', res)
            })

            // listen for the parser finding errors, warnings, notes,
            // as the build unfolds
            parser.on('new-entry', (entry: IBuildOutputParsedEntry) => {
                // let listeners know that we found an error/
                // warning/note, in the build output
                if (entry.type === 'error') {
                    this.emit('build-error', entry)
                } else if (entry.type === 'warning') {
                    this.emit('build-warning', entry)
                } else if (entry.type === 'note') {
                    this.emit('build-note', entry)
                }
            })

            // for clients that might be interested to get the
            // full build log, re-emit each chunk as it comes
            build.stdout.on('data', (data) => {
                this.emit('build-output', data.toString())
            })
            build.stderr.on('data', (data) => {
                this.emit('build-output', data.toString())
            })


            // build done - notify of success or failure
            build.on('close', (returnCode) => {
                // let listeners know the build is done
                this.emit('build-done', returnCode)

                if (returnCode !== 0) {
                    resolve('failure')
                } else {
                    resolve("success")
                }
            })
        })

    }
}