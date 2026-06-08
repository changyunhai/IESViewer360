import { uuid } from "@/util/common";
import { Math2d } from "@/util/math";
import EventEmitter from "eventemitter3";
import { Vector2Like, Vector3Like } from "three";

const DEFAULT_WALL_HEIGHT: number = 2.8;
export interface IPoint {
    x: number;
    y: number;
}
export interface ISimulatorID {
    uuid: string;
}
export interface ISimulatorScene {
    room: CSimulatorRoom;
    lights: CSimulatorIES[];
}

export class CSimulatorRoom implements ISimulatorID {
    public readonly uuid: string = uuid();
    public points: IPoint[];
    public wall_thickness: number;
    public height: number;
    public walls: CSimulatorWall[] = [];

    constructor(points: IPoint[], wall_thickness: number = 0.2, height: number = DEFAULT_WALL_HEIGHT) {
        this.points = points;
        this.wall_thickness = wall_thickness;
        this.height = height
        this.rebuildRoom();
    }

    public rebuildRoom() {
        console.assert(this.points.length > 3 && Math2d.isSamePoint(this.points[0], this.points[this.points.length - 1]), ' we need a closed loop for room')
        if (Math2d.isCCW(this.points)) this.points = this.points.reverse();

        const points = this.points;
        const ptExtends = Math2d.pointsExtends(points, true, this.wall_thickness, 'left')!
        for (let i = 0; i < points.length - 1; ++i) {
            const p0 = points[i], p1 = points[i + 1];
            let pts = [p0, p1, ptExtends[i + 1], ptExtends[i]];
            this.walls.push(new CSimulatorWall(p0, p1, this.height, pts))
        }
    }
}
export class CSimulatorWall implements ISimulatorID {
    public readonly uuid: string = uuid();
    public start: IPoint;
    public end: IPoint;
    public height: number;
    public walllines: IPoint[];

    public material?: string;

    constructor(start: IPoint, end: IPoint, height: number = DEFAULT_WALL_HEIGHT, walllines: IPoint[] = []) {
        this.start = start;
        this.end = end;
        this.walllines = walllines;
        this.height = height
    }
}

export class CSimulatorIES implements ISimulatorID {
    public readonly uuid: string = uuid();
    public point: IPoint;
    //public rotation: IPoint = { x: 0, y: 0, z: 0 };
    public name: string = "";
    public height: number = 2.5;
    public ies: string = '';
    /**default true */
    public on: boolean = true;
    public maintenance: number = 1.0;

    constructor(point: IPoint) {
        this.point = point;
    }
}


export const simulatorEvent: EventEmitter = new EventEmitter();

// test scene:
const rectRoomXSize = 8, rectRoomYSize = 8
const _points = [{ x: 0, y: 0 }, { x: 0, y: rectRoomYSize }, { x: rectRoomXSize, y: rectRoomYSize }, { x: rectRoomXSize, y: 0 }, { x: 0, y: 0 }]
const testIES: CSimulatorIES = new CSimulatorIES({ x: 4, y: 4 });
testIES.height = 4;
testIES.ies = 'LDP0109501.ies';
const room = new CSimulatorRoom(_points)
room.height = 8
room.rebuildRoom()
export const testSimulatorDataModel: ISimulatorScene = { room, lights: [testIES] }

