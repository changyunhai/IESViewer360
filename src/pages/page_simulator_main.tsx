

import * as THREE from 'three'
import { createRoot } from 'react-dom/client'
import React, { useRef, useState, useEffect } from 'react'

import { PerspectiveCamera } from '@react-three/drei'
import { InputNumber, Radio, RadioChangeEvent, notification, Input, Select, Switch, Slider, Tooltip, Button } from 'antd'
import { Layout, Flex } from 'antd';
import { AppstoreOutlined, MailOutlined, SettingOutlined, HomeOutlined, AlertOutlined, UserOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { Menu } from 'antd';
import PageSimulatorView from './page_simulator_view'
import { CSimulatorIES, IPoint, ISimulatorScene, simulatorEvent, testSimulatorDataModel } from '@/model/model_simulator'
import openDialog, { DefaultFooter } from '@/dialog/open_dialog'
import CreateRoom from '@/dialog/create_room/create_room_main'
import About from '@/dialog/about/about_main'
import { useMount, useUnmount } from 'ahooks'
import { Math2d } from '@/util/math'
import { utilThreeSimulatorCreateLight, utilThreeSimulatorGetFullRoomDistributionData, utilThreeSimulatorSceneCreate, utilThreeSimulatorSelectLight, utilThreeSimulatorUpdateLight, utilThreeSimulatorUpdatePlaneVertexColor, utilThreeSimulatorUpdatePlaneVertexIntensity } from '@/util/util_three_simulator'
import { systemTime, uuid } from '@/util/common'
import { addToIESLibrary, IES, IESEuclidDistributionItem, IES_LIBRARY, IES_SAMPLES } from '@/model/model_parser'
import { select } from 'snapsvg'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { utilThreeGetAllObjectsByNames, utilThreeGetContext, utilThreeInit, utilThreeInitSimulatorScene } from '@/util/util_three_common'
import clsx from 'clsx'
import { Object3D } from 'three'
import { randInt } from 'three/src/math/MathUtils'
import { GithubSvg } from '@/resource/resource'
import _ from 'lodash'
import { randomInt } from '../util/common'
import FileSaver from 'file-saver'
import { utilIESGetContext, utilIESIntegrate, utilIESOpenFile, utilIESSetContext } from '@/util/util_ies'
import JSZip from 'jszip'
const { Header, Footer, Sider, Content } = Layout;

const headerStyle: React.CSSProperties = {
    textAlign: 'center',
    color: '#fff',
    height: 64,
    paddingInline: 48,
    lineHeight: '64px',
    backgroundColor: '#4096ff',
};

const contentStyle: React.CSSProperties = {
    textAlign: 'center',
    minHeight: 120,
    lineHeight: '120px',
    color: '#0',
    backgroundColor: 'white',
};

const siderStyle: React.CSSProperties = {
    textAlign: 'center',
    //lineHeight: '120px',
    color: 'darkgray',
    backgroundColor: '#efefef',
    maxWidth: '120px',
    minWidth: '50px',
};

const footerStyle: React.CSSProperties = {
    textAlign: 'center',
    color: '#0',
    backgroundColor: 'white',
    border: 'solid 1px lightgray',
    //height: 50
};

const layoutStyle = {
    borderRadius: 8,
    overflow: 'hidden',

    //width: 'calc(50% - 8px)',
    //maxWidth: 'calc(50% - 8px)',
};

let scene: THREE.Scene | undefined;
let renderer: THREE.WebGLRenderer | undefined;
let transformControls: TransformControls
let _simulatorDataModel: ISimulatorScene; // https://react.dev/reference/react/useState#ive-updated-the-state-but-logging-gives-me-the-old-value

export default () => {

    const menuItems: MenuProps['items'] = [
        {
            label: 'Create Room',
            key: 'room',
            icon: <HomeOutlined />,
            onClick: async () => {
                const model: ISimulatorScene = await openDialog<ISimulatorScene>({
                    title: 'Create Room', width: 800,
                    content: <CreateRoom></CreateRoom>,
                })
                console.log('model', model);
                setSimulatorDataModel(model);
                setWallVisible(true);
                setDistributeInfo({ wall: undefined, floor: undefined })
            }
        },
        {
            label: 'Add IES light',
            key: 'ies',
            icon: <AlertOutlined />,
            onClick: () => {
                if (!simulatorDataModel) return notifyApi.info({ message: 'Room is needed.', placement: 'topLeft' });

                const newlightPos: IPoint = simulatorDataModel.lights.length == 0 ? Math2d.polyMassCenter(simulatorDataModel.room.points)! :
                    { x: simulatorDataModel.lights[simulatorDataModel.lights.length - 1].point.x, y: simulatorDataModel.lights[simulatorDataModel.lights.length - 1].point.y }
                newlightPos.x += 0.2; newlightPos.y += 0.2;
                const newLight: CSimulatorIES = new CSimulatorIES(newlightPos);
                newLight.height = simulatorDataModel.room.height - 0.01;
                simulatorDataModel.lights.push(newLight);
                utilThreeSimulatorCreateLight(newLight);
                setSelectLight(newLight);
                const { transformControls } = utilThreeGetContext();
                transformControls.enabled = false;
            }
        },
        {
            label: 'Settings',
            key: 'SubMenu',
            icon: <SettingOutlined />,
            disabled: true,
            children: [
                {
                    type: 'group',
                    label: 'Room',
                    children: [
                        {
                            label: 'Properties',
                            key: 'setting:properties',
                        }, {
                            label: 'Material',
                            key: 'setting:material',
                        },
                    ],
                },
                {
                    type: 'group',
                    label: 'View',
                    children: [
                        {
                            label: 'Color Map',
                            key: 'setting:colormap',
                        },

                    ],
                },
            ],
        },
        {
            label: 'About',
            icon: <UserOutlined />,
            key: 'about',
            onClick: async () => {
                await openDialog({
                    title: 'About', width: 500,
                    content: <About></About>
                })
            }
        },
    ];


    const canvasRef = useRef<HTMLCanvasElement>(null!);
    const [notifyApi, notifyContextHolder] = notification.useNotification();


    const [simulatorDataModel, setSimulatorDataModel] = useState<ISimulatorScene>(null!)//(testSimulatorDataModel)//
    const [selectLight, setSelectLight] = useState<CSimulatorIES | undefined>(null!);
    const [lightUpdateField, setLightUpdateField] = useState<string>('');
    const [wallVisible, setWallVisible] = useState<boolean>(true);
    const [colormap, setColormap] = useState<string>('gradient');
    const [colorRanges, setColorRanges] = useState<number[]>([0, 100]);// in percentage
    const [lightInfo, setLightInfo] = useState<{ lumininous: number, power: number }>({ lumininous: 0, power: 0 });

    const [distributeInfo, setDistributeInfo] = useState<{ wall: IESEuclidDistributionItem | undefined, floor: IESEuclidDistributionItem | undefined }>({ wall: undefined, floor: undefined });


    //const [currentMenuKey, setCurrentMenuKey] = useState<string>('');
    //const onMenuClick: MenuProps['onClick'] = (e) => {setCurrentMenuKey(e.key)}

    function simulatorEventHandler_select_light_id(id: string) {
        const light = _simulatorDataModel?.lights.find(l => l.uuid == id);
        setSelectLight(light);
        const threeLight: Object3D | undefined = light && utilThreeGetAllObjectsByNames(scene!, ['light']).find(l => l.uuid == id);
        if (threeLight) transformControls.attach(threeLight!);
        else transformControls.detach();
        transformControls.enabled = (threeLight != undefined);
    }

    function simulatorEventHandler_vertex_color_calc_complete(info: any) {
        setDistributeInfo(_.clone(info));
    }
    function simulatorEventHandler_object_transform_change(controls: TransformControls) {
        if (!controls.dragging) return;
        const threeLight = controls.object;
        if (!threeLight) return;
        const modelLight = _simulatorDataModel?.lights.find(l => l.uuid == threeLight.uuid)!;
        if (modelLight) {
            modelLight.point.x = threeLight.position.x;
            modelLight.point.y = -threeLight.position.z;
            modelLight.height = threeLight.position.y;
        }
        setLightUpdateField('point-' + randomInt());
    }

    async function zipFullRoomDistributionData(): Promise<Blob> {
        const data = utilThreeSimulatorGetFullRoomDistributionData();
        const titles = ['index', 'host',
            'surface.position.x', 'surface.position.y', 'surface.position.z',
            'surface.normal.x', 'surface.normal.y', 'surface.normal.z',
            //'ies.latitude', 'ies.longitude', 'ies.distance',
            'surface.intensity']
        const lines = [titles.join(', ')];
        data.forEach((item, index) => {
            const line = [index, item.uuid,
                item.position.x.toFixed(3), item.position.y.toFixed(3), item.position.z.toFixed(3),
                item.normal.x.toFixed(3), item.normal.y.toFixed(3), item.normal.z.toFixed(3),
                //item.distribute.latitude.toFixed(3), item.distribute.longitude.toFixed(3), item.distribute.distance.toFixed(3),
                item.distribute.toFixed(3)].join(', ');
            lines.push(line);
        })

        // add to zip:
        let zip = new JSZip();
        zip.file('data.csv', lines.join("\n"))
        zip.file('index.json', JSON.stringify(_simulatorDataModel, undefined, 4))
        return await zip.generateAsync({ type: "blob", compression: 'DEFLATE' })
    }
    const handleFileChange = (event: any) => {
        const file: File = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const fileContent = e.target!.result as string;
            addToIESLibrary(fileContent, file.name, file.name);

            selectLight!.ies = file.name;
            setLightUpdateField('ies-' + randomInt())
        };
        reader.readAsText(file);
    };

    // hooks:
    useMount(async () => {
        simulatorEvent.on('select_light_id', simulatorEventHandler_select_light_id);
        simulatorEvent.on('vertex_color_calc_complete', simulatorEventHandler_vertex_color_calc_complete);
        simulatorEvent.on('object_transform_change', simulatorEventHandler_object_transform_change);

        if (scene) return;
        const view3dDom: HTMLCanvasElement = canvasRef.current as HTMLCanvasElement;
        utilThreeInit(view3dDom);
        utilThreeInitSimulatorScene();
        const context = utilThreeGetContext();
        scene = context.scene;
        renderer = context.renderer;
        transformControls = context.transformControls;

        // this is a test for opendialog, remove it when ready...
        //setSimulatorDataModel(await openDialog({ title: 'Create Room', width: 800, content: <CreateRoom></CreateRoom>, }))
        setWallVisible(true);
    })
    useUnmount(() => {
        simulatorEvent.off('select_light_id', simulatorEventHandler_select_light_id);
        simulatorEvent.off('vertex_color_calc_complete', simulatorEventHandler_vertex_color_calc_complete);
        simulatorEvent.off('object_transform_change', simulatorEventHandler_object_transform_change);
    })

    useEffect(() => {
        _simulatorDataModel = simulatorDataModel;// 
        setSelectLight(undefined);
        if (simulatorDataModel) utilThreeSimulatorSceneCreate(simulatorDataModel);
    }, [simulatorDataModel])

    useEffect(() => {
        utilThreeSimulatorSelectLight(selectLight ? selectLight.uuid : '');

        const info: { lumininous: number, power: number } = { lumininous: 0, power: 0 }
        const ies: IES | undefined = selectLight && IES_LIBRARY[selectLight.ies] && IES_LIBRARY[selectLight.ies].ies;
        if (ies) { info.power = ies.header.power; info.lumininous = utilIESIntegrate(IES_LIBRARY[selectLight!.ies].tensor); }
        setLightInfo(info)
    }, [selectLight]);

    useEffect(() => {
        if (!selectLight) return console.assert(selectLight, "no select light, checks: " + lightUpdateField)
        utilThreeSimulatorUpdateLight(simulatorDataModel, selectLight.uuid);
        if (lightUpdateField.startsWith('name') || lightUpdateField.startsWith('ui')) return;

        utilThreeSimulatorUpdatePlaneVertexIntensity(simulatorDataModel);
        utilThreeSimulatorUpdatePlaneVertexColor(colormap, colorRanges);

        if (lightUpdateField.startsWith('ies')) {
            const info: { lumininous: number, power: number } = { lumininous: 0, power: 0 }
            const ies: IES | undefined = selectLight && IES_LIBRARY[selectLight.ies] && IES_LIBRARY[selectLight.ies].ies;
            if (ies) { info.power = ies.header.power; info.lumininous = utilIESIntegrate(IES_LIBRARY[selectLight!.ies].tensor); }
            setLightInfo(info)
        }

    }, [lightUpdateField]);

    useEffect(() => {
        const { scene } = utilThreeGetContext();
        utilThreeGetAllObjectsByNames(scene!, ['wall']).forEach(mesh => mesh.visible = wallVisible)
    }, [wallVisible]);

    useEffect(() => {
        utilThreeSimulatorUpdatePlaneVertexColor(colormap, colorRanges)
    }, [colormap, colorRanges])

    return <>
        {notifyContextHolder}
        <div className='h-screen'>
            <Layout className='w-full h-full' style={layoutStyle}>
                <Header className='w-full bg-white'>
                    <Menu className='w-full' selectedKeys={[]} mode="horizontal" items={menuItems} />
                </Header>
                <Layout>
                    <Content style={contentStyle}>
                        <div className='h-full'>
                            <canvas className='w-full h-full' ref={canvasRef}></canvas>
                        </div>
                        {/* <PageSimulatorView model={simulatorDataModel}></PageSimulatorView> */}
                    </Content>
                    <Sider width="25%" style={siderStyle}>
                        <div className='mt-4 mb-4 '>Total lights:<span className='ml-2 text-red-300'>{simulatorDataModel ? simulatorDataModel.lights.length : 0}</span></div>
                        <fieldset className='ml-2 mr-2'>
                            <legend className='text-left'>light intensity</legend>
                            <div>Wall  max: <span className='ml-2 text-red-300'>{distributeInfo.wall ? distributeInfo.wall.intensity.toFixed(2) : 0} lx  {distributeInfo.wall ? `[${parseFloat(distributeInfo.wall.position.x.toFixed(2))}, ${parseFloat(distributeInfo.wall.position.y.toFixed(2))}, ${parseFloat(distributeInfo.wall.position.z.toFixed(2))}]` : ''}</span></div>
                            <div>Floor max: <span className='ml-2 text-red-300'>{distributeInfo.floor ? distributeInfo.floor.intensity.toFixed(2) : 0} lx  {distributeInfo.floor ? `[${parseFloat(distributeInfo.floor.position.x.toFixed(2))}, ${parseFloat(distributeInfo.floor.position.y.toFixed(2))}, ${parseFloat(distributeInfo.floor.position.z.toFixed(2))}]` : ''}</span></div>
                            <div className=' mt-2'>
                                <Tooltip title='save distribution intensity data in CSV.' >
                                    <Button type='primary' onClick={async () => {
                                        const data = await zipFullRoomDistributionData()
                                        FileSaver.saveAs(data, `light-distribution-${systemTime()}.zip`);
                                        notifyApi.info({ message: `download succcess`, placement: 'topRight' })
                                    }}>Save Data</Button>
                                </Tooltip>
                            </div>
                        </fieldset>
                        {selectLight ? <fieldset className='ml-2 mr-2'>
                            <legend className='text-left'>Select light</legend>
                            <div className='flex mt-3'>On<Switch className='ml-5' checked={selectLight.on} onChange={(checked: boolean) => {
                                selectLight.on = checked;
                                setLightUpdateField('on-' + randomInt())
                            }} />
                                <span className={clsx('ml-5 text-red-500', Math2d.pointInPoly(selectLight.point, simulatorDataModel.room.points) && selectLight.height < simulatorDataModel.room.height && selectLight.height > 0 ? 'hidden' : '')}>
                                    Warn: outside the room.
                                </span>
                            </div>
                            <div className='flex mt-3'>Name<Input className='ml-3' value={selectLight.name} onChange={(e) => {
                                selectLight.name = e.target.value;
                                setLightUpdateField('name-' + randomInt());
                            }}></Input></div>
                            <div className='flex mt-3'>Position
                                <InputNumber className='ml-3' step={0.01} value={parseFloat(selectLight.point.x.toFixed(2))} onChange={(value: number | null) => {
                                    selectLight.point.x = value!;
                                    setLightUpdateField('point-' + randomInt())
                                }}></InputNumber>
                                <InputNumber value={parseFloat(selectLight.point.y.toFixed(2))} step={0.01} onChange={(value: number | null) => {
                                    selectLight.point.y = value!;
                                    setLightUpdateField('point-' + randomInt())
                                }}></InputNumber>
                            </div>
                            <div className='flex mt-3'>Height <InputNumber className='ml-3' step={0.01} value={parseFloat(selectLight.height.toFixed(2))} onChange={(value: number | null) => {
                                selectLight.height = value!;
                                setLightUpdateField('height-' + randomInt())
                            }}></InputNumber></div>
                            <div className='flex mt-3'>IES
                                <Select className='ml-3'
                                    defaultValue={selectLight.ies} style={{ width: 150 }}
                                    onChange={(value: string) => {
                                        selectLight.ies = value;
                                        setLightUpdateField('ies-' + randomInt());
                                    }}
                                    options={[
                                        { value: '', label: '-- Plese select --' }].concat(Object.keys(IES_SAMPLES).map(key => {
                                            return { value: key, label: IES_SAMPLES[key] }
                                        }))}
                                /><span className='ml-3 mr-3'>Or</span>
                                <Input className='w-32' type="file" accept='.ies' onChange={handleFileChange} />
                            </div>
                            <div className='flex mt-3'>Maintenance
                                <Slider className='ml-5 w-1/3' value={selectLight.maintenance} step={0.01} min={0.2} max={1.0} onChange={(value) => {
                                    selectLight.maintenance = value;
                                    setLightUpdateField('maintenance-' + randomInt())
                                }}></Slider>
                            </div>
                            <div className='flex mt-3'>Lumininous <span className='ml-2 text-red-300'>{lightInfo.lumininous.toFixed(3)} lm </span></div>
                            <div className='flex mt-3'>Power <span className='ml-2 text-red-300'>{lightInfo.power.toFixed(3)} W  </span></div>
                        </fieldset> : null}
                    </Sider>
                </Layout>
                <Footer style={footerStyle}>
                    <div className='flex w-full'>
                        Wall:<Switch className='ml-5 mr-8' checked={wallVisible} onChange={(checked: boolean) => setWallVisible(checked)} />
                        <Select value={colormap} style={{ width: 300 }} onChange={(value: string) => setColormap(value)}
                            options={[
                                { value: 'gradient', label: <img src='asset/gradient.jpg' /> },
                                { value: 'solid', label: <img src='asset/solid.jpg' /> },
                                { value: 'grayscale', label: <img src='asset/grayscale.jpg' /> },
                            ]}></Select>
                        <Slider className='ml-5 w-64' range value={colorRanges} min={1} max={100} onChange={(value) => { setColorRanges(value!) }}></Slider>
                        <Tooltip title='Navigate to view single IES'>
                            <GithubSvg className="w-8 h-8 ml-auto cursor-pointer" onClick={() => window.open('https://changyunhai.github.io/IESViewer360/build/')} />
                        </Tooltip>
                    </div>
                </Footer>
            </Layout>
        </div>
    </>
}


