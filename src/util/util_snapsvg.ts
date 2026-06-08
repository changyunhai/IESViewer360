import { IES } from '@/model/model_parser';
import 'snapsvg-cjs';
import { linearProject, toRadian } from './common';
import { utilIESGetContext, utilIESSetContext } from './util_ies';
declare const Snap: any;

const CANVAS_MAX_SIZE: number = 400;

let paper: Snap.Paper;
let layers: { [key: string]: Snap.Paper } = {};

export function utilSnapGetContext() { return { paper, layers } }


export function utilSnapInitBySvg(dom: SVGElement): Snap.Paper {
    paper = Snap(dom)
    const bound = paper.node.getBoundingClientRect();
    paper.attr({ "xmlns:xlink": "http://www.w3.org/1999/xlink", width: bound.width, height: bound.height, preserveAspectRatio: "xMidYMid" });
    paper.attr({ "viewBox": `${-bound.width / 2} ${-bound.height / 2} ${bound.width} ${bound.height}` });

    if (process.env.NODE_ENV == 'development') {
        (window as any).utilSnapGetContext = utilSnapGetContext;
    }
    return paper
}
export function utilSnapInitByDiv(container: HTMLDivElement): Snap.Paper {
    throw new Error(", for furture uses.")
    paper = Snap();
    container.appendChild(paper.node);
    utilSnapInitParserScene()
    return paper;
}

//-------
export function utilSnapInitSimulatorScene(){
    const base = layers['base'] = paper.g();
    layers['draw'] = paper.g();

}

export function utilSnapInitParserScene() {
    const S: number = CANVAS_MAX_SIZE, margin = 10;
    const bound = paper.node.getBoundingClientRect()

    const size = Math.min(S, Math.floor(bound.width));
    paper.attr({ width: size, height: size, "viewBox": `${-S / 2 - margin} ${-S / 2 - margin} ${S + 2 * margin} ${S + 2 * margin}` });
    const base = layers['base'] = paper.g();
    layers['draw'] = paper.g();

    // build base:

    base.line(-2 * S, 0, 2 * S, 0).attr({ stroke: 'gray' })
    base.line(0, -2 * S, 0, 2 * S).attr({ stroke: 'gray' });

    [50, 100, 150, 200, 250].forEach((r: number) => {
        base.circle(0, 0, r).attr({ fill: 'none', stroke: 'lightgray' });
    })
    for (let i = 0; i < 360; i += 10) {
        base.line(0, 50, 0, S).attr({ stroke: 'lightgray' }).transform(`r${i} 0 0`);
    }
    return paper;
}

export function utilSnapSetIES(_ies: IES) {
    utilIESSetContext(_ies)
}

export function utilSnapShowIES(longitude: number) {
    const draw: Snap.Paper = layers['draw'];
    draw.clear();
    const iesFullData = utilIESGetContext().tensor;
    if (!iesFullData) return;
    const S: number = CANVAS_MAX_SIZE / 2;
    const positive_data = iesFullData[longitude];
    const negative_data = iesFullData[360 - longitude];
    const max = Math.max(...positive_data, ...negative_data);

    draw.text(-S, -S + 20, max.toFixed(1)).attr({ 'font-size': 20, fill: 'black' });

    const r = [];
    for (let theta = 0; theta < 360; ++theta) {
        // polar coord:
        let d = theta < 180 ? iesFullData[longitude][theta] : iesFullData[360 - longitude][360 - theta];
        r.push(linearProject([0, max], [0, S], d))
    }

    const pathPoint: number[][] = [];
    for (let theta = 0; theta < 360; ++theta) {
        pathPoint.push([r[theta] * Math.sin(toRadian(theta)), r[theta] * Math.cos(toRadian(theta))]);
    }
    const pathStr = 'M' + pathPoint.map(pt => `${pt[0]} ${pt[1]}`).join('L') + 'Z';
    draw.path(pathStr).attr({ fill: 'yellow', stroke: 'red', opacity: 0.5 })
}