import random from "random";
import { MathUtils, Vector3, Vector3Like } from "three";
import { v4 as uuidv4 } from 'uuid';

export function systemTime(): number {
    var n = new Date();
    return n.getSeconds() * 1 +
        n.getMinutes() * 100 +
        n.getHours() * 10000 +
        n.getDate() * 10000 * 100 +
        (n.getMonth() + 1) * 10000 * 10000 +
        n.getFullYear() * 10000 * 10000 * 100;
}
export function systemMonth(): number {
    var n = new Date();
    return (n.getMonth() + 1) +
        n.getFullYear() * 100;
}

export function systemObjectKey(category: string, id: string, fileNamePrefix: string, fileNameExt: string): string {
    const objectKey: string = `ies_designer/${systemMonth()}/${category}/${id}/${fileNamePrefix}_${systemTime()}_${random.int(100, 5000)}.${fileNameExt}`;
    return objectKey;
}
export function uuid(): string {
    return uuidv4();
}

export function sleep(milliseconds: number): Promise<any> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/** linear project, project the number from one range to another.  */
export function linearProject(srcRange: number[], destRange: number[], srcNum: number): number {
    let lerp = (srcNum - srcRange[0]) / (srcRange[1] - srcRange[0]);
    if (!isFinite(lerp)) lerp = srcNum > srcRange[0] ? 1 : 0;
    return (destRange[1] - destRange[0]) * lerp + destRange[0];
}

export function toRadian(degree: number): number { return degree * Math.PI / 180; }
export function toDegree(radian: number): number { return radian / Math.PI * 180; }
export function normalizeDegree(degree: number, max: number): number { return (degree + max * 5) % max; }

const _tmp_vec: Vector3 = new Vector3();
/** for rectanglar coord, Y-up; polar coord: Y-down. the result is in degree 
 * Note: This coord transfer is only for ies space and feature.
*/
export function rectanglarCoordToPolarCoord(rectPoint: Vector3Like, polePosition: Vector3Like): { latitude: number, longitude: number } {
    const coord = { latitude: -1, longitude: -1 };
    _tmp_vec.subVectors(polePosition, rectPoint);
    coord.longitude = toDegree(Math.atan2(_tmp_vec.z, _tmp_vec.x));
    coord.latitude = toDegree(Math.atan2(Math.sqrt(_tmp_vec.x * _tmp_vec.x + _tmp_vec.z * _tmp_vec.z), _tmp_vec.y));
    return coord;
}
export function randomInt(max: number = 10000): number {
    return MathUtils.randInt(1, max)
}