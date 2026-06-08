import { CSimulatorRoom, ISimulatorScene } from "@/model/model_simulator"
import { MoveSvg, RoomSvg, RotateSvg } from "@/resource/resource"
import { Button, InputNumber, Layout, Radio, RadioChangeEvent } from "antd"
import { Header, Content, Footer } from "antd/es/layout/layout"
import Sider from "antd/es/layout/Sider"
import { useState } from "react"
import { styled } from "styled-components"
import { DefaultFooter, IDialog } from "../open_dialog"
import { useMount, useUnmount } from "ahooks"
import _ from "lodash"
import Create_room_drawing from "./create_room_drawing"

interface IRoomSetting {
    rect_size: number[];
    height: number;
    wall_thickness: number;
    grid_gap: number;
}

const DEFAULT_ROOM_SETTING: IRoomSetting = { rect_size: [6, 4], height: 2.8, wall_thickness: 0.2, grid_gap: 0.5 };

export default ({ onSubmit, onCancel }: IDialog<ISimulatorScene>) => {
    let roomSetting = _.cloneDeep(DEFAULT_ROOM_SETTING);

    const data: ISimulatorScene = { room: new CSimulatorRoom([]), lights: [] }

    const [roomType, setRoomType] = useState<string>('rect');// rect or userDefined
    const [currentPage, setCurrentPage] = useState<number>(0);// 0 or 1

    // room settings:
    const [rectRoomXSize, setRectRoomXSize] = useState<number>(0);
    const [rectRoomYSize, setRectRoomYSize] = useState<number>(0);
    const [roomHeight, setRoomHeight] = useState<number>(0);
    const [wallThickness, setWallThickness] = useState<number>(0);

    function setParameters() {
        setRectRoomXSize(roomSetting.rect_size[0]);
        setRectRoomYSize(roomSetting.rect_size[1]);
        setRoomHeight(roomSetting.height);
        setWallThickness(roomSetting.wall_thickness);
    }

    function getParameters() {
        roomSetting.rect_size[0] = rectRoomXSize;
        roomSetting.rect_size[1] = rectRoomYSize;
        roomSetting.height = roomHeight;
        roomSetting.wall_thickness = wallThickness;
    }

    useMount(() => {
        if (window.localStorage['roomSetting'] !== undefined) roomSetting = JSON.parse(window.localStorage['roomSetting']);
        setParameters();
    })

    useUnmount(() => {
        getParameters();
        window.localStorage['roomSetting'] = JSON.stringify(roomSetting);
    })

    return <>
        <Layout className="h-96 bg-white" style={{}}>
            {
                currentPage == 0 && <>
                    <Sider width="45%" style={{ backgroundColor: 'lightgray' }} className="bg-white">
                        <RoomSvg className="w-full h-full" />
                    </Sider>
                    <Layout>
                        <Content >
                            <div><span className="w-32 mr-5 ml-3">Room type:</span>
                                <Radio.Group onChange={(e: RadioChangeEvent) => setRoomType(e.target.value)} value={roomType}>
                                    <Radio value={'rect'}>Rect </Radio>
                                    <Radio value={'userDefined'} >Draw yourself</Radio>
                                </Radio.Group>
                            </div>
                            <div className={roomType == 'rect' ? '' : 'hidden'}><span className="w-32 mr-5 ml-3" >Length:</span>
                                <InputNumber className="w-20 ml-3" step={0.1} min={1} max={15} value={rectRoomXSize} onChange={(value: number | null) => { setRectRoomXSize(value!) }}></InputNumber>
                                m</div>
                            <div className={roomType == 'rect' ? '' : 'hidden'}><span className="w-32 mr-5 ml-3" >Width:</span>
                                <InputNumber className="w-20 ml-3" step={0.1} min={1} max={15} value={rectRoomYSize} onChange={(value: number | null) => { setRectRoomYSize(value!) }}></InputNumber>
                                m</div>
                            <div className={roomType == 'rect' ? '' : ''}><span className="w-32 mr-5 ml-3" >Height:</span>
                                <InputNumber className="w-20 ml-3" step={0.1} min={1} max={15} value={roomHeight} onChange={(value: number | null) => { setRoomHeight(value!) }}></InputNumber>
                                m</div>
                            <div className={roomType == 'rect' ? '' : ''}><span className="w-32 mr-5 ml-3" >Wall thickness:</span>
                                <InputNumber className="w-20 ml-3" step={0.05} min={0} max={1} value={wallThickness} onChange={(value: number | null) => { setWallThickness(value!) }}></InputNumber>
                                m</div>
                            <div className={roomType == 'rect' ? '' : ''}>
                                <Button className="ml-60" type='primary' onClick={() => { roomSetting = _.cloneDeep(DEFAULT_ROOM_SETTING); setParameters() }}>Reset</Button>
                            </div>
                        </Content>
                        <DefaultFooter okText={roomType == 'rect' ? 'OK' : "Next"} onSubmit={() => {
                            // set vlues:
                            data.room.height = roomHeight;
                            data.room.wall_thickness = wallThickness;

                            if (roomType == 'rect') {
                                const rectPoints = [{ x: 0, y: 0 }, { x: 0, y: rectRoomYSize }, { x: rectRoomXSize, y: rectRoomYSize }, { x: rectRoomXSize, y: 0 }, { x: 0, y: 0 }]
                                const lsharpPoints = [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 8 }, { x: 4, y: 8 }, { x: 4, y: 6 }, { x: 0, y: 6 }, { x: 0, y: 0 }];
                                data.room.points = rectPoints;//lsharpPoints;//
                                data.room.rebuildRoom();
                            }
                            // next:
                            if (roomType != 'rect') setCurrentPage(1);
                            else if (onSubmit) onSubmit(data);
                        }} onCancel={onCancel} />
                    </Layout></>
            }
            {
                currentPage == 1 && <> <Layout>
                    <Content >
                        <Create_room_drawing simulatorScene={data} gridGap={roomSetting.grid_gap}></Create_room_drawing>
                    </Content>
                    <DefaultFooter onSubmit={() => {
                        data.room.rebuildRoom();
                        if (onSubmit) onSubmit(data);
                    }} onCancel={onCancel} />
                </Layout></>
            }
        </Layout>

    </>
}