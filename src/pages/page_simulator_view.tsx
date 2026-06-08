
import * as THREE from 'three'
import { createRoot } from 'react-dom/client'
import React, { useEffect, useRef, useState } from 'react'

import { InputNumber, Radio, RadioChangeEvent, Space, Divider } from 'antd'
import { Box, Sphere } from './component3d/test'
import { AppstoreOutlined, MailOutlined, SettingOutlined, HomeOutlined, AlertOutlined, UserOutlined } from '@ant-design/icons';
import { MoveSvg, DoorSvg, RotateSvg, StoreySvg } from '@/resource/resource'
import ViewHelper from './component3d/viewHelper'
import { useMount, useUnmount } from 'ahooks'
import { utilThreeGetAllObjectsByNames, utilThreeInit, utilThreeInitSimulatorScene } from '@/util/util_three_common'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { ISimulatorScene } from '@/model/model_simulator'
import { utilThreeSimulatorSceneCreate } from '@/util/util_three_simulator'


let scene: THREE.Scene | undefined;
let renderer: THREE.WebGLRenderer | undefined;
let controls: OrbitControls;


export default ({ model }: { model: ISimulatorScene }) => {
    const [xCount, setXCount] = useState<number>(1); // test
    const [yCount, setYCount] = useState<number>(1); // test

    const canvasRef = useRef<HTMLCanvasElement>(null!);

    const [operator, setOperator] = useState<string>('move')
    const [displayMode, setDisplayMode] = useState<string>('storey')//storey or room

    const [modelScene, setModelScene] = useState<ISimulatorScene>(null!);

    if (model != modelScene) setModelScene(model);

    useMount(() => {
        // init 3d view:
        const view3dDom: HTMLCanvasElement = canvasRef.current as HTMLCanvasElement;

        if (scene) return;
        const init3d = utilThreeInit(view3dDom);
        utilThreeInitSimulatorScene();
        scene = init3d.scene;
        renderer = init3d.renderer;
        controls = init3d.controls;
    })
    useUnmount(() => {
        console.log('unmount 3d view');
        return;
        renderer?.dispose();
        scene = undefined;
    })

    useEffect(() => {
        utilThreeSimulatorSceneCreate(modelScene);
    }, [modelScene])

    return <>
        <div className='h-full'>
            <canvas className='w-full h-full' ref={canvasRef} >
                
            </canvas>

            <div className='absolute hidden top-20 left-5 bg-slate-300/50 border-solid rounded-lg border border-gray-100'>
                {false && <><Radio.Group onChange={(e: RadioChangeEvent) => setOperator(e.target.value)} value={operator}>
                    <Space direction="vertical">
                        <Radio value={'move'}><MoveSvg className='w-5 h-5' /></Radio>
                        <Radio value={'rotate'} ><RotateSvg className='w-5 h-5' /></Radio>
                    </Space>
                </Radio.Group>
                    <Divider /></>
                }
                <Radio.Group onChange={(e: RadioChangeEvent) => {
                    utilThreeGetAllObjectsByNames(scene!, ['wall']).forEach(mesh => mesh.visible = e.target.value == 'storey')
                    setDisplayMode(e.target.value)
                }} value={displayMode}>
                    <Space direction="vertical">
                        <Radio value={'storey'}><StoreySvg className='w-5 h-5' /></Radio>
                        <Radio value={'room'}><DoorSvg className='w-5 h-5' /></Radio>
                    </Space>
                </Radio.Group>
            </div>

            <div className='hidden absolute  top-20  left-32 bg-slate-300/50 border-solid rounded-lg border-gray-100'>
                <InputNumber value={xCount} onChange={(value: number | null) => setXCount(value || 1)}></InputNumber>
                x
                <InputNumber value={yCount} onChange={(value: number | null) => setYCount(value || 1)}></InputNumber>

            </div>
        </div>
    </>;
}