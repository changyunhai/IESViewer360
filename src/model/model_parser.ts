import { utilIESGetContext, utilIESOpenFile, utilIESSetContext } from "@/util/util_ies";
import axios from "axios";
import { Vector3 } from "three";


export interface IES {
    name: string;
    header: {
        /**角度上面的行的内容 */
        content: string[];

        /**垂直角度, 纬度[0,180] */
        latitude: number[];

        /**水平角度, 经度[0,360] */
        longitude: number[];

        /** 功率(瓦特) (W) */
        power: number;
    };
    /** data[longitude.index][latitude.index] */
    data: number[][];
}

export interface IESContext {
    ies: IES;
    /** number[360][180], longitude x latitude = 360x180*/
    tensor: number[][];
}

/** in polar coord */
export interface IESPolarDistributionItem {
    /** [0,180]*/
    latitude: number;
    /** [0,360]*/
    longitude: number;
    /** default 1 */
    distance: number;
    intensity: number;
}
export interface IESEuclidDistributionItem {
    position: Vector3;
    normal: Vector3;
    intensity: number;
}

/** key: id;  value: description */
export const IES_SAMPLES: { [key: string]: string } = {
    'LDP0109501.ies': 'BiKong Serial',
    'LTD0110301.ies': 'Hao-Mini',
    'MTD0700312.ies': 'HaoRaoPLUS',
    'test.ies': "Test"
};

export const IES_LIBRARY: { [key: string]: IESContext } = {}

export function addToIESLibrary(iesContent: string, name: string, description: string | undefined) {
    const ies: IES | undefined = utilIESOpenFile(iesContent, name);
    if (!ies) return;
    utilIESSetContext(ies);
    IES_LIBRARY[name] = utilIESGetContext();
    IES_SAMPLES[name] = description || name;
}

export async function initIESTenser() {
    const keys = Object.keys(IES_SAMPLES);
    for (let i = 0; i < keys.length; ++i) {
        const key = keys[i];
        const iesContent = (await axios.get('asset/' + key)).data;
        addToIESLibrary(iesContent, key, IES_SAMPLES[key]);
    }
}

if (process.env.NODE_ENV == 'development') {
    (window as any).IES_LIBRARY = IES_LIBRARY;
}