/*
 * Copyright (C) 2017 Ericsson and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

// TODO: replace usage of gcc-output-parser  by a generic parser that can be
// extended to parse other log types

const gccOutputParser = require('gcc-output-parser')
import { IBuildLogParser, IBuildOutputParsedEntry } from "./build-parser"
import { AbstractBuildParser } from "./abstract-build-parser"

// output of gcc-output-parser
interface IGccBuildOutputParsedEntry {
    type: String
    filename: String
    line: number
    column: number
    text: String
    codeWhiteSpace: String
    code: String
    adjustedColumn: number
    startIndex: number
    endIndex: number
    parentFunction: String
}

/**
 * Parses a gcc build log, to find instances of errors, warnings
 * and notes.
 */
export class GccBuildParser extends AbstractBuildParser implements IBuildLogParser {
    myChunkOverlap: number = 200

    /**
     * constructor.
     * @param: inputStream - stream containing the log to parse
     */
    constructor(inputStream: NodeJS.ReadableStream, chunkOverlap?: number) {
        super(inputStream)
        if (chunkOverlap) {
            this.myChunkOverlap = chunkOverlap
        }
    }

    getDefaultChunkOverlapValue(): number {
        return this.myChunkOverlap
    }

    doParse(buffer: Buffer, indexOffset: number): IBuildOutputParsedEntry[] {
        let parsedEntries: IBuildOutputParsedEntry[] = []

        // parse gcc output using "gcc-output-parser"
        let entries: IGccBuildOutputParsedEntry[] = gccOutputParser.parseString(buffer)

        // convert gcc-output-parser output format to IGccBuildOutputParsedEntry
        for (let entry of entries) {
            let parsedEntry: IBuildOutputParsedEntry = {
                type: entry.type,
                filename: entry.filename,
                line: entry.line,
                column: entry.column,
                text: this.getLog().substring(entry.startIndex + indexOffset, entry.endIndex + indexOffset),
                startIndex: entry.startIndex + indexOffset,
                endIndex: entry.endIndex + indexOffset,
            }
            parsedEntries.push(parsedEntry)
        }
        return parsedEntries
    }
}
