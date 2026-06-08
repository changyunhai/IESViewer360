

import { ISimulatorScene } from "@/model/model_simulator"
import { Bound, Math2d } from "@/util/math";
import { utilSnapInitBySvg } from "@/util/util_snapsvg";
import { SvgView, svgEvents } from "@/util/view";
import { useMount, useUnmount } from "ahooks"
import { Button, InputNumber } from "antd";
import clsx from "clsx";
import _ from "lodash";
import { useEffect, useRef, useState } from "react";

let svgView: SvgView;
let currentDrawingPoint: Snap.Element;
let eventDispatcher: EventTarget = document.createElement('div');//暂时用div代替
let _gridInterval: number; // MUST use in global, ref https://react.dev/reference/react/useState#ive-updated-the-state-but-logging-gives-me-the-old-value

if (process.env.NODE_ENV == 'development') {
    (window as any).utilSnapGetContext = () => ({ svgView, currentDrawingPoint, eventDispatcher });
}

export default ({ simulatorScene: simultionScene, gridGap }: { simulatorScene: ISimulatorScene, gridGap: number }) => {
    const scene: ISimulatorScene = simultionScene;

    const svgRef = useRef<SVGSVGElement>(null!);
    const [gridInterval, setGridInterval] = useState<number>(gridGap);
    const [mode, setMode] = useState<string>('view'); // view or draw
    const [lineLength, setLineLength] = useState<number>(NaN);

    const snapToGrid = (num: number) => Math.round(num / _gridInterval) * _gridInterval

    const onDrawingMouseEvent = (event: Event) => {
        if (currentDrawingPoint.attr("display") == 'none') return;
        const mouseEvt: MouseEvent = (event as any).detail.evt;

        if (mouseEvt.type == 'mousedown') {
            scene.room.points.push({ x: parseFloat(currentDrawingPoint.attr("cx")), y: parseFloat(currentDrawingPoint.attr("cy")) })
            if (scene.room.points.length > 2 && Math2d.isSamePoint(scene.room.points[0], scene.room.points[scene.room.points.length - 1])) {
                setMode('view');
                setLineLength(NaN);
            }
        } else if (mouseEvt.type == 'mousemove') {
            let pt = svgView.projectDomToDrawing({ x: mouseEvt.pageX, y: mouseEvt.pageY })
            pt = { x: snapToGrid(pt.x), y: snapToGrid(-pt.y) }
            currentDrawingPoint.attr({ cx: pt.x, cy: pt.y })

            const lineLength = scene.room.points.length > 0 ? Math2d.lineLength(scene.room.points[scene.room.points.length - 1], pt) : NaN
            setLineLength(lineLength);

            if (scene.room.points.length > 0) {
                svgView.clearLayer("wall")
                const wallLayer = (svgView.layers as any)['wall'];
                const pts = _.concat(scene.room.points, pt);
                const ptsStr = "M" + pts.map(pt => pt.x + "," + pt.y).join("L");
                wallLayer.add(svgView.context.path(ptsStr).attr({ stroke: 'black', 'stroke-width': 2, "vector-effect": "non-scaling-stroke", fill: 'none' }))
                wallLayer.add(svgView.context.path(ptsStr + "Z").attr({ fill: 'yellow', 'opacity': 0.3 }))
            }
        }
    }

    useMount(() => {
        svgView = new SvgView(null, svgRef.current, eventDispatcher, "2d");
        svgView.clear().createGrid(gridInterval);
        svgView.fit({ x: 0, y: 0, width: 4, height: 4 })

        currentDrawingPoint = svgView.context.circle(0, 0, 0.02).attr({
            display: 'none', fill: 'red'
        });
        (svgView.layers as any)['mouse'].add(currentDrawingPoint);
        eventDispatcher.addEventListener(svgEvents.mouse, onDrawingMouseEvent)

        // eventDispatcher.addEventListener(svgEvents.viewportChange, (e) => {
        //     // for test:
        //     const vp = svgView.viewport;
        //     svgView.clearLayer('debug');
        //     (svgView.layers as any)['debug'].add(svgView.context.line(
        //         vp.center().x, vp.center().y,
        //         vp.center().x + vp.width / 2, vp.center().y + vp.height / 2).attr({ stroke: 'yellow', 'stroke-width': 0.02 }));
        // })
    })


    useUnmount(() => {
        eventDispatcher.removeEventListener(svgEvents.mouse, onDrawingMouseEvent);
    })

    useEffect(() => {
        _gridInterval = gridInterval
        svgView.clearLayer('grid').createGrid(gridInterval)
        console.log('set  grid interval effect', _gridInterval)
    }, [gridInterval])

    useEffect(() => {
        currentDrawingPoint.attr({ display: (mode == 'view' ? 'none' : 'block') })
        //(svgView.layers as any)['mouse'].attr({ display: (mode ? 'block' : 'none') })
    }, [mode])

    return <>
        <div className='w-full h-full'>
            <svg className='border-slate-400 border border-solid w-full h-full' ref={svgRef} xmlns="http://www.w3.org/2000/svg"></svg>
            <div className='absolute flex top-15  left-5 bg-slate-300 border-solid rounded-lg border-gray-100 '>
                Grid: <InputNumber step={0.05} min={0.05} max={1} value={gridInterval} onChange={(value: number | null) => { setGridInterval(value || 1) }}></InputNumber>
                <span className={clsx(isFinite(lineLength) ? 'block' : 'hidden')}>Length: <span className="ml-1 text-red-400">{Math.round(lineLength * 1000)}mm</span></span>
                <Button className='ml-3' onClick={() => {
                    svgView.clearLayer('wall').clearLayer('dimension')
                    scene.room.points = [];
                    setMode('draw');
                }}>Draw</Button>
                <Button className='ml-1' onClick={() => {
                    svgView.clear().createGrid(gridInterval)
                    scene.room.points = [];
                }}>Clear</Button>
                <Button className='ml-1' onClick={() => svgView.fit(new Bound(0, 0, 2, 2,))}>Fit</Button>
            </div>
        </div>
    </>
}