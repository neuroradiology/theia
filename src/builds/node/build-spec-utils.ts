import * as Stream from "stream";
import * as Events from "events";

// note: copied/renamed from mi-spec-utils.ts
// these can be useful for probably other components.
// make them available as part of some global test utils?

export namespace BuildUtils {

    /* FIXME merge common code with debug-test-utils */
    export function waitForNamedEvent(eventHandler: Events.EventEmitter, name: string) {
        return new Promise((resolve, reject) => {
            eventHandler.on(name, (obj: any) => {
                resolve(obj);
            });
        });
    }

    export function waitForNamedEventCount(eventHandler: Events.EventEmitter, name: string, count: number) {
        let hits: number = 0;
        let events: Object[] = [];

        return new Promise((resolve, reject) => {
            eventHandler.on(name, (obj: any) => {
                hits++;
                events.push(obj);
                if (hits === count) {
                    resolve(events);
                }
            });
        });
    }

    export function startWithInput(str: string,
        start: (inStream: Stream.Readable, outStream: Stream.PassThrough) => void): void {

        /* Setup in out stream for start */
        let inStream = new Stream.Readable;
        let outStream = new Stream.PassThrough();

        inStream.push(str);
        inStream.push(null);

        start(inStream, outStream);
    }

}