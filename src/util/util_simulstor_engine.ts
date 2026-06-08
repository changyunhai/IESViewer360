import { IES_LIBRARY } from "@/model/model_parser";
import { color } from "snapsvg";
import { Vector2Like, Vector3, Vector3Like } from "three";
import { linearProject, randomInt } from "./common";
import { utilIESGetPointIntensity } from "./util_ies";

export interface ISimulatorEngineLight {
    on: boolean;
    ies: string;
    point: Vector2Like;
    height: number;
    maintenance: number;
}

const _tmp_pos: Vector3 = new Vector3();
const _tmp_normal: Vector3 = new Vector3();
const _tmp_color: Vector3 = new Vector3();

export function utilSimulatorEngineCalculateOnePointIntensity(position: Vector3Like, normal: Vector3Like, lights: ISimulatorEngineLight[]): number {
    let intensity: number = 0;
    for (let i = 0; i < lights.length; ++i) {
        const light: ISimulatorEngineLight = lights[i];
        const tensor = IES_LIBRARY[light.ies] && IES_LIBRARY[light.ies].tensor
        if (light.on !== true || !tensor) continue;
        _tmp_pos.set(light.point.x, light.height, -light.point.y);
        const distribute = utilIESGetPointIntensity(tensor, _tmp_pos, position, normal);//{intensity:randomInt(10)};//
        intensity += distribute.intensity * light.maintenance;
    }
    return intensity;
}

export function utilSimulatorEngineCalculateOnePointColor(intensity: number, maxIntensity: number, colorSpace: number[][], colorRange: number[], lerpColor: boolean = false, colorReturns?: Vector3): Vector3Like {
    const returnColor = colorReturns || _tmp_color;
    const maxIntensityLog = Math.log2(maxIntensity)
    const intensityRange = colorRange.map(num => maxIntensityLog * num / 100);
    let colorIndexAccurate = linearProject(intensityRange, [0, colorSpace.length], Math.log2(intensity));
    colorIndexAccurate = Math.max(0, Math.min(colorIndexAccurate, colorSpace.length - 1));
    if (!lerpColor) {
        const colorArr = colorSpace[Math.round(colorIndexAccurate)]
        returnColor.set(colorArr[0], colorArr[1], colorArr[2]);
    } else {
        // todo
        console.error("todo in future.")
    }
    return returnColor;
}