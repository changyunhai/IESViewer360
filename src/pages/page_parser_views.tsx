import { IES } from "../model/model_parser"
import { Input, InputNumber, RadioChangeEvent, Slider } from 'antd';
import { Button, Select, Space, Tooltip, Checkbox } from 'antd';
import { useMount, useUnmount } from 'ahooks';
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { utilIESGetSphereMaxDistribution, } from '../util/util_ies';

import FileSaver from 'file-saver';
import { sleep, systemTime } from '../util/common';
import type { CollapseProps, MenuProps } from 'antd';
import { Collapse, Dropdown, Radio } from 'antd';
import { DownOutlined } from '@ant-design/icons';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { utilThreeGetRoomMaxDistribution, utilThreeSetIES, utilThreeShowSphereLatitudeLongitude, utilThreeInit, utilThreeSetSphereColormap, utilThreeSetCurrentLongitude, utilThreeSetLightHeight, utilThreeSetSphereVisible, utilThreeSetRoomVisible, utilThreeSetGridVisible, utilThreeBuildRoom, utilThreeSetRoomColormap, utilThreeGetFullRoomDistributionData, utilThreeInitParserScene } from "../util/util_three_common";
import { utilSnapSetIES, utilSnapInitBySvg, utilSnapShowIES, utilSnapInitParserScene } from "@/util/util_snapsvg";
import { color } from "snapsvg";
import { Vector3Like, Scene } from "three";

let scene: Scene | undefined;
let renderer: THREE.WebGLRenderer | undefined;
let controls: OrbitControls;


const DEFAULT_ROOM_SIZE = { x: 8, y: 6, z: 8 };//{ x: 12, y: 8, z: 12 };//
const DEFAULT_IES_HEIGHT = 4;

export default ({ ies }: { ies: IES | undefined }) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const svgRef = useRef<SVGSVGElement | null>(null);

    const [iesModel, setIESModel] = useState<IES | undefined>(ies);
    const [colormap, setColormap] = useState<string>('gradient');

    const [currentLongitude, setCurrentLongitude] = useState<number>(10);
    const [longitudeStep, setLongitudeStep] = useState<number>(1);

    const [sphereInterval, setSphereInterval] = useState<number>(10);// in angles
    const [sphereCenterToGround, setSphereCenterToGround] = useState<number>(DEFAULT_IES_HEIGHT);// in meters
    const [sphereColorRanges, setSphereColorRanges] = useState<number[]>([0, 100]);// in percentage

    const [roomColorRanges, setRoomColorRanges] = useState<number[]>([0, 100]);// in percentage
    const [roomGridInterval, setRoomGridInterval] = useState<number>(0.1);// in meters
    const [roomXlen, setRoomXlen] = useState<number>(DEFAULT_ROOM_SIZE.x);// in meters, 
    const [roomYlen, setRoomYlen] = useState<number>(DEFAULT_ROOM_SIZE.y);// in meters 
    const [roomZlen, setRoomZlen] = useState<number>(DEFAULT_ROOM_SIZE.z);// in meters   
    const [roomCenterX, setRoomCenterX] = useState<number>(0);// in meters,
    const [roomCenterZ, setRoomCenterZ] = useState<number>(0);// in meters 

    const [sphereVisible, setSphereVisible] = useState<boolean>(true);
    const [roomVisible, setRoomVisible] = useState<boolean>(true);
    const [gridVisible, setGridVisible] = useState<boolean>(true);

    if (ies != iesModel) setIESModel(ies);

    function printFullRoomDistributionData(): string[] {
        const data = utilThreeGetFullRoomDistributionData();
        const titles = ['index', 'surface.position.x', 'surface.position.y', 'surface.position.z',
            'surface.normal.x', 'surface.normal.y', 'surface.normal.z',
            'ies.latitude', 'ies.longitude', 'ies.distance',
            'surface.intensity']
        const lines = [titles.join(', ')];
        data.forEach(item => {
            const line = [item.index, item.position.x.toFixed(3), item.position.y.toFixed(3), item.position.z.toFixed(3),
            item.normal.x.toFixed(3), item.normal.y.toFixed(3), item.normal.z.toFixed(3),
            item.distribute.latitude.toFixed(3), item.distribute.longitude.toFixed(3), item.distribute.distance.toFixed(3),
            item.distribute.intensity.toFixed(3)].join(', ');
            lines.push(line);
        })
        return lines;
    }

    useMount(() => {
        // init 3d view:
        const view3dDom: HTMLCanvasElement = canvasRef.current as HTMLCanvasElement;
        const view2dDom = svgRef.current;

        console.log('mount 3d view', ies);
        if (scene) return;
        const init3d = utilThreeInit(view3dDom);
        utilThreeInitParserScene();
        scene = init3d.scene;
        renderer = init3d.renderer;
        controls = init3d.controls;

        //const init2d = utilSnapInit(view2dDom as HTMLDivElement);
        const init2d2 = utilSnapInitBySvg(view2dDom as SVGElement);
        utilSnapInitParserScene()
    })
    useUnmount(() => {
        console.log('unmount 3d view');
        return;
        renderer?.dispose();
        scene = undefined;
    })

    useEffect(() => {
        // init ies:
        if (!iesModel) return;
        const max = utilIESGetSphereMaxDistribution()
        setCurrentLongitude(max.longitude)
        setLongitudeStep(iesModel?.header.longitude![1]! - iesModel?.header.longitude![0]!);

        // view in 2d and 3d:
        utilSnapSetIES(iesModel);
        utilSnapShowIES(max.longitude);

        utilThreeSetIES(iesModel);
        utilThreeShowSphereLatitudeLongitude(sphereInterval);
        utilThreeSetSphereColormap(colormap as any, sphereColorRanges);
        utilThreeBuildRoom(roomGridInterval, roomXlen, roomYlen, roomZlen, roomCenterX, roomCenterZ)
        utilThreeSetRoomColormap(colormap as any, roomColorRanges);
        //utilThreeSetCurrentLongitude(max.longitude);

    }, [iesModel]);

    useEffect(() => {
        //console.log("currentFrame=", currentFrame);
        // view in 2d and 3d:
        utilSnapShowIES(currentLongitude);
        utilThreeSetCurrentLongitude(currentLongitude);
    }, [currentLongitude])

    useEffect(() => {
        utilThreeSetSphereColormap(colormap as any, sphereColorRanges);
    }, [colormap, sphereColorRanges])

    useEffect(() => {
        utilThreeSetRoomColormap(colormap, roomColorRanges);
    }, [colormap, roomColorRanges])

    useEffect(() => {
        utilThreeShowSphereLatitudeLongitude(sphereInterval);
    }, [sphereInterval])

    useEffect(() => {
        utilThreeSetLightHeight(sphereCenterToGround);
        utilThreeSetRoomColormap(colormap, roomColorRanges);
    }, [sphereCenterToGround])

    useEffect(() => {
        utilThreeSetSphereVisible(sphereVisible);
    }, [sphereVisible])

    //----------------rooms:
    useEffect(() => {
        utilThreeSetRoomVisible(roomVisible);
    }, [roomVisible])

    useEffect(() => {
        utilThreeSetGridVisible(gridVisible);
    }, [gridVisible])

    useEffect(() => {
        utilThreeBuildRoom(roomGridInterval, roomXlen, roomYlen, roomZlen, roomCenterX, roomCenterZ);
        utilThreeSetRoomColormap(colormap, roomColorRanges);
    }, [roomCenterX, roomCenterZ, roomYlen, roomXlen, roomGridInterval, roomZlen])


    function getMaxDistributeString(normal?: Vector3Like): string {
        const max = utilThreeGetRoomMaxDistribution(normal);
        return `(x: ${parseFloat(max.position.x.toFixed(2))}, y: ${parseFloat(max.position.y.toFixed(2))}, z: ${parseFloat(max.position.z.toFixed(2))}); (${parseFloat(max.intensity.latitude.toFixed(2))}°, ${parseFloat(max.intensity.longitude.toFixed(2))}°, ${parseFloat(max.intensity.distance.toFixed(2))}) -> ${max.intensity.intensity.toFixed(3)} lx`
    }
    const viewCollapseItems: CollapseProps['items'] = [
        {
            key: 'view2d',
            label: '2D View',
            children: <>
                <div className='w-full h-full'>
                    <svg className='border-black border border-solid' ref={svgRef} xmlns="http://www.w3.org/2000/svg"></svg>
                </div>
            </>,

        },
        {
            key: 'view3d',
            label: '3D View',
            children: <>
                <div className='w-full h-full mt-5' >
                    <canvas className='w-full h-full' ref={canvasRef} ></canvas>
                </div>
                <fieldset>
                    <legend className='text-left'>Room Info</legend>
                    <div className='text-left'>
                        Max Wall: <span className='text-red-400 ml-4 mr-5'>{getMaxDistributeString({ x: 1, y: 0, z: 1 })}</span>
                    </div>
                    <div className='text-left'>
                        Max Floor: <span className='text-red-400 ml-4 mr-5'>{getMaxDistributeString({ x: 0, y: 1, z: 0 })}</span>
                    </div>
                    <div>
                        <Tooltip title='Download Room Full Data'>
                            <Button className='ml-5 w-40' type='primary' onClick={() => FileSaver.saveAs(new Blob([printFullRoomDistributionData().join('\n')]), `full-room-distribution-${systemTime()}.csv`)} >Save Distribution CSV</Button>
                        </Tooltip>
                    </div>
                </fieldset>
            </>
        },
        {
            key: 'general.setting',
            label: 'General Settings',
            children: <>
                <fieldset>
                    <legend className='text-left'>Visibility</legend>
                    <div className='text-left inline-flex'>
                        <Checkbox className="" checked={sphereVisible} onChange={(e) => { setSphereVisible(e.target.checked) }}>Sphere</Checkbox>
                        <Checkbox className="ml-8" checked={roomVisible} onChange={(e) => { setRoomVisible(e.target.checked) }}>Room</Checkbox>
                        <Checkbox className="ml-8" checked={gridVisible} onChange={(e) => { setGridVisible(e.target.checked) }}>Grid</Checkbox>
                    </div>
                    <div className='text-left '>
                    </div>
                </fieldset>
                <fieldset>
                    <legend className='text-left'>Colors</legend>
                    <Radio.Group onChange={(e: RadioChangeEvent) => setColormap(e.target.value)} value={colormap}>
                        <Space direction="vertical">
                            <Radio value='gradient'><img src='asset/gradient.jpg' /></Radio>
                            <Radio value='solid'><img src='asset/solid.jpg' /></Radio>
                            <Radio value='grayscale'><img src='asset/grayscale.jpg' /></Radio>
                        </Space>
                    </Radio.Group>
                </fieldset>

            </>
        },
        {
            key: 'sphere.setting',
            label: 'Sphere Settings',
            children: <>
                <div className='text-left '>To Ground:
                    <InputNumber className="w-12 ml-3" min={1} max={15} value={sphereCenterToGround} onChange={(value: number | null) => { setSphereCenterToGround(value!) }}></InputNumber>m
                </div>
                <div className='text-left flex'>Color(%):
                    <Slider className='ml-3 w-4/5' range value={sphereColorRanges} max={100} onChange={(values) => { setSphereColorRanges(values) }} ></Slider>
                </div>
                <div className='text-left '>Grid Interval:
                    <Select className='ml-3'
                        defaultValue='10'
                        style={{ width: 80 }}
                        onChange={(value: string) => { setSphereInterval(parseInt(value)) }}
                        options={[
                            { value: 5, label: 5 },
                            { value: 10, label: 10 },
                            { value: 15, label: 15 },
                            { value: 30, label: 30 },
                        ]}
                    />°
                </div>
            </>
        },
        {
            key: 'room.setting',
            label: 'Room Settings',
            children: <>
                <div className='text-left  flex '>Color(%):
                    <Slider className='ml-3 w-4/5' range value={roomColorRanges} min={1} max={100} onChange={(value) => { setRoomColorRanges(value!) }}></Slider>
                </div>
                <div className='text-left '>Grid Space:
                    <InputNumber className="w-16 ml-3" min={0.1} max={5} step={0.1} defaultValue={0.1} value={roomGridInterval} onChange={(value: number | null) => { setRoomGridInterval(value!) }}></InputNumber>m
                </div>

                <fieldset>
                    <legend className='text-left'>Size</legend>
                    <div className='text-left '>Length(X):
                        <InputNumber className="w-16 ml-3" min={1} max={50} step={0.5} defaultValue={DEFAULT_ROOM_SIZE.x} value={roomXlen} onChange={(value: number | null) => { setRoomXlen(value!) }}></InputNumber>m
                    </div>
                    <div className='text-left '>Height(Y):
                        <InputNumber className="w-16 ml-3" min={1} max={50} step={0.5} defaultValue={DEFAULT_ROOM_SIZE.y} value={roomYlen} onChange={(value: number | null) => { setRoomYlen(value!) }}></InputNumber>m
                    </div>
                    <div className='text-left '>Depth(Z):
                        <InputNumber className="w-16 ml-3" min={1} max={50} step={0.5} defaultValue={DEFAULT_ROOM_SIZE.z} value={roomZlen} onChange={(value: number | null) => { setRoomZlen(value!) }}></InputNumber>m
                    </div>
                </fieldset>
                <fieldset>
                    <legend className='text-left'>Location</legend>
                    <div className='text-left '>Center X:
                        <InputNumber className="w-16 ml-3" step={0.5} defaultValue={0} value={roomCenterX} onChange={(value: number | null) => { setRoomCenterX(value!) }}></InputNumber>m
                    </div>
                    <div className='text-left '>Center Z:
                        <InputNumber className="w-16 ml-3" step={0.5} defaultValue={0} value={roomCenterZ} onChange={(value: number | null) => { setRoomCenterZ(value!) }}></InputNumber>m
                    </div>
                </fieldset>
            </>
        }
    ];

    return <>
        <Slider onChange={setCurrentLongitude} step={longitudeStep} value={currentLongitude} max={iesModel ? iesModel.header.longitude[iesModel.header.longitude.length - 1] : 360} tooltip={{ open: true }} />
        <Collapse items={viewCollapseItems} defaultActiveKey={['view2d', 'view3d', '']} />
    </>
}