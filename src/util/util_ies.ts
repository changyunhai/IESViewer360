import _ from "lodash";
import { Vector3, Vector3Like } from "three";
import { IES, IESContext, IESPolarDistributionItem } from "../model/model_parser";
import { linearProject, normalizeDegree, rectanglarCoordToPolarCoord } from "./common";


let ies: IES;
let ies_tensor: number[][];/** number[longitude.index][latitude.index], = 360x180 */

export function utilIESSetContext(_ies: IES) {
    ies = _ies;
    ies_tensor = utilIESBuildTensor();
}

export function utilIESGetContext(): IESContext {
    return { ies, tensor: ies_tensor }
}

export function utilIESOpenFile(content: string, name: string): IES | undefined {
    if (content.length < 1024) return;
    const lines = content.split("\n").map(line => line.trim());
    if (!lines[0].startsWith('IESNA')) {
        console.error("not IES file");
        return;
    }
    const ies: IES = { name, header: { content: [], latitude: [], longitude: [], power: -1 }, data: [] };
    const data_flat: number[] = [];

    let tilt_index: number = -1;
    lines.forEach((line, i) => {
        if (line.startsWith("TILT=")) { tilt_index = i }
    })
    if (tilt_index == -1) throw new Error("can not find TILE in ies file, invalid ies")

    let latitudeCount = -1, longitudeCount = -1;
    lines.forEach((line, i) => {
        if (i <= tilt_index + 2) {
            ies.header.content.push(line);
        }

        if (i == tilt_index + 1) {
            const nums = line.split(" ")
            latitudeCount = parseInt(nums[3])
            longitudeCount = parseInt(nums[4])
            // todo others...
        } else if (i == tilt_index + 2) {
            const nums = line.split(" ")
            ies.header.power = parseFloat(nums[2]);
        } else if (i > tilt_index + 2) {
            line.split(' ').forEach(num => {
                if (_.isEmpty(num)) return;
                const val = parseFloat(num.trim());
                data_flat.push(val);
            })
        }
    })

    if (latitudeCount == -1 || longitudeCount == -1) throw new Error("parse error, invalid count");

    for (let i = 0; i < latitudeCount; ++i)ies.header.latitude.push(data_flat.shift()!)
    for (let i = 0; i < longitudeCount; ++i)ies.header.longitude.push(data_flat.shift()!)


    if (data_flat.length != ies.header.longitude.length * ies.header.latitude.length)
        console.error(`invalid data count: v_angles=${ies.header.latitude.length},h_anbles=${ies.header.longitude.length}, expected=${ies.header.longitude.length * ies.header.latitude.length},actual=${data_flat.length}`);
    else {
        for (let i = 0; i < ies.header.longitude.length; ++i) {
            const nums: number[] = [];
            ies.data.push(nums);
            for (let j = 0; j < ies.header.latitude.length; ++j) {
                nums.push(data_flat.shift()!)
            }
        }
    }
    console.log('openfile', ies);

    return ies;
}

export function utilIESSaveFile(): string[] {
    const lines: string[] = [];

    ies.header.content.forEach(l => lines.push(l))
    ies.data.forEach(nums => {
        const line = nums.map(num => num.toFixed(3)).join(' ')
        lines.push(line);
    })

    return lines;
}

/** Internal uses. */
function utilIESGetIntensity(_ies_tensor: number[][] | undefined, latitude: number, longitude: number): number {
    _ies_tensor = _ies_tensor || ies_tensor;
    if (!ies) return 0;
    if (latitude < 0 || latitude > 180 || longitude < 0 || longitude > 360) throw new Error(`latitude[0,180] or longitude[0,360] out of range, actually=${latitude}, ${longitude}`)
    const la_lb = Math.floor(latitude), la_ub = Math.ceil(latitude), lo_lb = Math.floor(longitude), lo_ub = Math.ceil(longitude);
    if (la_lb == la_ub && lo_lb == lo_ub) {
        return _ies_tensor[lo_lb][la_lb];
    } else if (la_lb == la_ub) {
        return linearProject([lo_lb, lo_ub], [_ies_tensor[lo_lb][la_lb], _ies_tensor[lo_ub][la_ub]], longitude);
    } else if (lo_lb == lo_ub) {
        return linearProject([la_lb, la_ub], [_ies_tensor[lo_lb][la_lb], _ies_tensor[lo_ub][la_ub]], latitude);
    } else {
        const interpolate1 = linearProject([lo_lb, lo_ub], [_ies_tensor[lo_lb][la_lb], _ies_tensor[lo_ub][la_lb]], longitude);
        const interpolate2 = linearProject([lo_lb, lo_ub], [_ies_tensor[lo_lb][la_ub], _ies_tensor[lo_ub][la_ub]], longitude);
        return linearProject([la_lb, la_ub], [interpolate1, interpolate2], latitude);
    }
    return 0;
}

function utilIESGetIntensity2(latitude: number, longitude: number): number {
    if (!ies) return 0;

    if (latitude < 0 || latitude > 180 || longitude < 0 || longitude > 360) throw new Error(`latitude[0,180] or longitude[0,360] out of range, actually=${latitude}, ${longitude}`)
    const maxIESLatitude = ies.header.latitude[ies.header.latitude.length - 1], maxIESLongitude = ies.header.longitude[ies.header.longitude.length - 1]
    if (latitude > maxIESLatitude) return 0;
    latitude = latitude % (maxIESLatitude + 1); longitude = longitude % (maxIESLongitude + 1); // todo fix bugs
    let prevLatIdx = -1, prevLonIdx = -1, exactLatIdx = -1, exactLogIdx = -1;
    for (let la = 0; la < ies.header.latitude.length; ++la) {
        if (latitude == ies.header.latitude[la]) exactLatIdx = la
        if (latitude > ies.header.latitude[la] && latitude < ies.header.latitude[la + 1]) prevLatIdx = la;
    }
    for (let lo = 0; lo < ies.header.longitude.length; ++lo) {
        if (longitude == ies.header.longitude[lo]) exactLogIdx = lo
        if (longitude > ies.header.longitude[lo] && longitude < ies.header.longitude[lo + 1]) prevLonIdx = lo;
    }

    //水平方向各向同性，仅做一次竖直方向的线性差值
    if (exactLatIdx != -1 && exactLogIdx != -1) {
        return ies.data[exactLogIdx][exactLatIdx];
    } else if (exactLatIdx != -1) {
        return linearProject([ies.header.longitude[prevLonIdx], ies.header.longitude[prevLonIdx + 1]],
            [ies.data[prevLonIdx][exactLatIdx], ies.data[prevLonIdx + 1][exactLatIdx]], longitude);
    } else if (exactLogIdx != -1) {
        return linearProject([ies.header.latitude[prevLatIdx], ies.header.latitude[prevLatIdx + 1]],
            [ies.data[exactLogIdx][prevLatIdx], ies.data[exactLogIdx][prevLatIdx + 1]], latitude);

    }

    // if (ies.header.longitude.length == 1) {//水平方向各向同性，仅做一次竖直方向的线性差值
    //     prevLonIdx = 0;
    //     return linearProject([ies.header.latitude[prevLatIdx], ies.header.latitude[prevLatIdx + 1]],
    //         [ies.data[prevLonIdx][prevLatIdx], ies.data[prevLonIdx][prevLatIdx + 1]], latitude);
    // }

    //双线性插值, 先latitude,再longitude:
    if (prevLatIdx == -1 || prevLonIdx == -1) throw new Error(`Error: can not find index:[${latitude},${longitude}]`);

    let interpolate: number;
    const la_first = false;
    if (la_first) {
        const interpolate1 = linearProject([ies.header.latitude[prevLatIdx], ies.header.latitude[prevLatIdx + 1]],
            [ies.data[prevLonIdx][prevLatIdx], ies.data[prevLonIdx][prevLatIdx + 1]], latitude);
        const interpolate2 = linearProject([ies.header.latitude[prevLatIdx], ies.header.latitude[prevLatIdx + 1]],
            [ies.data[prevLonIdx + 1][prevLatIdx], ies.data[prevLonIdx + 1][prevLatIdx + 1]], latitude);
        interpolate = linearProject([ies.header.longitude[prevLonIdx], ies.header.longitude[prevLonIdx + 1]],
            [interpolate1, interpolate2], longitude);
    } else {
        const interpolate1 = linearProject([ies.header.longitude[prevLonIdx], ies.header.longitude[prevLonIdx + 1]],
            [ies.data[prevLonIdx][prevLatIdx], ies.data[prevLonIdx + 1][prevLatIdx]], longitude);
        const interpolate2 = linearProject([ies.header.longitude[prevLonIdx], ies.header.longitude[prevLonIdx + 1]],
            [ies.data[prevLonIdx][prevLatIdx + 1], ies.data[prevLonIdx + 1][prevLatIdx + 1]], longitude);
        interpolate = linearProject([ies.header.latitude[prevLatIdx], ies.header.latitude[prevLatIdx + 1]],
            [interpolate1, interpolate2], latitude);
    }

    return interpolate!;
}

export function utilIESGetSphereMaxDistribution(): IESPolarDistributionItem {
    const rv: IESPolarDistributionItem = { latitude: -1, longitude: -1, intensity: -1, distance: 1 }
    if (!ies) return rv;
    ies.header.latitude.forEach((la, la_idx) => {
        ies.header.longitude.forEach((lo, lo_idx) => {
            const intensity = ies.data[lo_idx][la_idx]
            if (intensity > rv.intensity) {
                rv.intensity = intensity; rv.latitude = la; rv.longitude = lo;
            }
        })
    })
    return rv;
}

function utilIESBuildTensor(): number[][] {
    if (!ies) throw new Error('need ies context')
    const data: number[][] = [];
    for (var i = 0; i <= 360; ++i) {
        const line: number[] = [];
        data.push(line);
        for (var j = 0; j <= 180; ++j) line.push(utilIESGetIntensity2(j, i));
    }
    return data;
}

export function utilIESIntegrate(_ies_tensor: number[][] | undefined): number {
    _ies_tensor = _ies_tensor || ies_tensor;
    let rv = 0;
    const latitude_count = 180, longitude_count = 360;
    for (let lo = 0; lo < longitude_count; ++lo) {
        for (let la = 0; la < latitude_count; ++la) {
            rv += _ies_tensor[lo][la] * Math.sin(la / latitude_count * Math.PI) * (Math.PI / latitude_count * (2 * Math.PI) / longitude_count);
        }
    }
    return rv;
}

const _tmp_dir: Vector3 = new Vector3();
const _tmp_normal: Vector3 = new Vector3();

export function utilIESGetPointIntensity(_ies_tensor: number[][] | undefined, iesPosition: Vector3Like, point: Vector3Like, normal?: Vector3Like): IESPolarDistributionItem {
    //console.log('calculate point intensity distribution',point,ies)
    _ies_tensor = _ies_tensor || ies_tensor;
    const rv: IESPolarDistributionItem = { intensity: -1, latitude: -1, longitude: -1, distance: -1 }
    if (!ies) return rv;

    _tmp_dir.subVectors(iesPosition, point);

    const polarCoord = rectanglarCoordToPolarCoord(point, iesPosition);
    rv.latitude = normalizeDegree(polarCoord.latitude, 180);
    rv.longitude = normalizeDegree(polarCoord.longitude, 360);
    const distanceSq = _tmp_dir.lengthSq()
    rv.distance = Math.sqrt(distanceSq);

    const intensity = utilIESGetIntensity(_ies_tensor, rv.latitude, rv.longitude);
    const slopeAngle = normal ? _tmp_dir.angleTo(_tmp_normal.copy(normal)) : 0;
    const intensityProj = normal ? intensity * Math.cos(slopeAngle) : intensity;
    rv.intensity = intensityProj / distanceSq;
    return rv;
}


if (process.env.NODE_ENV == 'development') {
    (window as any).utilIESGetPointIntensity = utilIESGetPointIntensity;// for test
}