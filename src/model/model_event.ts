// deprecated, used for a event bus test in the system.

import EventEmitter from "eventemitter3";


export const EventType: { [key: string]: string } = {
    iesChanged: "iesChanged",

    sphereNeedRebuild: "sphereNeedRebuild",
    sphereBuildComplete: "sphereBuildComplete",
    sphereNeedRedraw: 'sphereNeedRedraw',

    roomNeedRebuild: "roomNeedRebuild",
    roomBuildComplete: "roomBuildComplete",
    roomNeedRedraw: 'roomNeedRedraw',
}

export const contextEvent: EventEmitter = new EventEmitter();

contextEvent.on(EventType.iesChanged, () => {
    contextEvent.emit(EventType.sphereNeedRebbuild);
    contextEvent.emit(EventType.roomNeedRebuild);
}).on(EventType.sphereBuildComplete, () => {
    contextEvent.emit(EventType.sphereNeedRedraw);
}).on(EventType.roomBuildComplete, () => {
    contextEvent.emit(EventType.roomNeedRedraw)
})