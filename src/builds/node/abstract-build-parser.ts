/*
 * Copyright (C) 2017 Ericsson and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { IBuildLogParser, IParsedBuildLog, IBuildOutputParsedEntry } from "./build-parser"
import * as Events from "events"


/**
 * Base class to parse build logs, to find instances of errors, warnings
 * and notes.
 */
export abstract class AbstractBuildParser extends Events.EventEmitter implements IBuildLogParser {
    private _parsedBuildLog: IParsedBuildLog = {
        entries: [],
        errors: 0,
        warnings: 0,
        notes: 0
    }
    private _originalLog: String = ""
    private _inputStream: NodeJS.ReadableStream
    private _chunkOverlap = 0

    /**
     * constructor.
     * @param: inputStream - stream containing the log to parse
     */
    constructor(inputStream: NodeJS.ReadableStream) {
        super()
        this.inputStream = inputStream
    }

    /**
     * Returns the value for parameter "chunk overlap". This is a parser-specific
     * value, that depends on the nature of the log being parsed. Since the log is
     * received through a stream, and that each received chunk could contain a partial
     * entry we want to parse, it's necessary to consider part of the previous chunk,
     * when parsing a chunk, to avoid missing entries. This value should be about the
     * largest expected size for an entry.
     */
    abstract getDefaultChunkOverlapValue(): number

    /**
     * Parse for errors, warnings, etc in the buffer given as parameter. Returns
     * an array of IBuildOutputParsedEntry, one entry per error, warning, note found.
     *
     * @param buffer - Buffer containing potential error, warning, ... entries
     * @param: indexOffset - offset of the current chunk from the beginning of the log
    */
    abstract doParse(buffer: Buffer, indexOffset: number): IBuildOutputParsedEntry[]

    /**
     * The size, in bytes, of the overlap to have between log stream chunks. For
     * the second and following chunks, we append a part of the previous chunk
     * before parsing. This is to avoid missing an entry that is split between
     * two chunks. The correct size of the required overlap might change depending
     * on the log type
     */
    private set chunkOverlap(value: number) {
        if (value > 0) {
            this._chunkOverlap = value
        }
    }

    private get chunkOverlap(): number {
        return this._chunkOverlap
    }

    private set parsedBuildLog(content: IParsedBuildLog) {
        this._parsedBuildLog = content
    }

    private get parsedBuildLog(): IParsedBuildLog {
        return this._parsedBuildLog
    }

    private set originalLog(log: String) {
        this._originalLog = log
    }

    private get originalLog(): String {
        return this._originalLog
    }

    private set inputStream(stream: NodeJS.ReadableStream) {
        this._inputStream = stream
    }

    private get inputStream(): NodeJS.ReadableStream {
        return this._inputStream
    }

    /** returns the plaintext of the build log */
    getLog(): String {
        return this.originalLog
    }

    /** returns the parsed build log */
    getParsedLog(): IParsedBuildLog {
        return this.parsedBuildLog
    }

    public parse(): Promise<IParsedBuildLog> {

        this.chunkOverlap = this.getDefaultChunkOverlapValue()

        let offset = 0
        return new Promise<IParsedBuildLog>((resolve, reject) => {
            try {
                let firstIteration: boolean = true
                let stream: NodeJS.ReadableStream = this.inputStream
                let parsedEntries: IBuildOutputParsedEntry[]

                // a log chunk has arrived
                stream.on('data', (chunk: Buffer) => {
                    this.originalLog += chunk.toString()

                    if (firstIteration) {
                        parsedEntries = this.doParse(chunk, offset)
                    } else {
                        // start parsing a little before the chunk, in case
                        // an entry is split between the current chunk and the
                        // previous one
                        parsedEntries = this.doParse(
                            new Buffer(this.originalLog.substring(offset - this.chunkOverlap, offset + chunk.length)),
                            offset - this.chunkOverlap
                        )
                    }

                    for (let parsedEntry of parsedEntries) {
                        // avoid duplicated entries
                        if (!this.isEntryKnown(parsedEntry)) {
                            this.parsedBuildLog.entries.push(parsedEntry)
                            try {
                                this.emit('new-entry', parsedEntry)
                            } catch (err) {
                                console.log("Error caught while emitting: " + err)
                            }

                            // keep basic statistics
                            if (parsedEntry.type.indexOf("error") !== -1) {
                                this.parsedBuildLog.errors++
                            } else if (parsedEntry.type === "warning") {
                                this.parsedBuildLog.warnings++
                            } else if (parsedEntry.type === 'note') {
                                this.parsedBuildLog.notes++
                            }
                        }
                    }
                    offset += chunk.length
                    firstIteration = false
                })

                stream.on('error', (err: String) => {
                    this.emit('error', err)
                    reject(err)
                })

                // finished parsing log, emit "done" event, provide stats
                stream.on('end', () => {
                    this.emit('done', {
                        errors: this.parsedBuildLog.errors,
                        warnings: this.parsedBuildLog.warnings,
                        notes: this.parsedBuildLog.notes,
                    })
                    resolve(this.parsedBuildLog)
                })

            } catch (err) {
                reject(err)
            }
        })
    }

    /**
     * Compares a parsed build entry to all known ones. Returns whether the
     * entry is duplicated.
     */
    private isEntryKnown(entry: IBuildOutputParsedEntry): boolean {
        let knownEntries = this.parsedBuildLog.entries
        for (let i = 0; i < knownEntries.length; i++) {
            if (knownEntries[i].startIndex === entry.startIndex &&
                knownEntries[i].endIndex === entry.endIndex &&
                knownEntries[i].text === entry.text &&
                knownEntries[i].column === entry.column &&
                knownEntries[i].filename === entry.filename &&
                knownEntries[i].line === entry.line &&
                knownEntries[i].type === entry.type
            ) {
                return true
            }
        }
        return false
    }

}
