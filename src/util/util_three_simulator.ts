import { CSimulatorIES, IPoint, ISimulatorScene, simulatorEvent } from "@/model/model_simulator";
import {
    BufferGeometry, ExtrudeGeometry, Group, Mesh, MeshBasicMaterial, MeshLambertMaterial,
    MeshStandardMaterial, Shape, ShapeGeometry, ShapeUtils, Vector2, Vector2Like, Vector3Like, Vector3,
    Float32BufferAttribute, Box3Helper,
    SphereGeometry,
    Color,
    BoxHelper
} from "three";
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { toRadian } from "./common";
import { Math2d } from "./math";
import { utilThreeGetAllObjectsByNames, utilThreeGetContext, utilThreeObjectClear } from "./util_three_common";
import { LoopSubdivision } from 'three-subdivide';
import _ from "lodash";
import { TessellateModifier } from 'three/examples/jsm/modifiers/TessellateModifier.js';
import wall from "@/pages/component3d/wall";
import { ISimulatorEngineLight, utilSimulatorEngineCalculateOnePointColor, utilSimulatorEngineCalculateOnePointIntensity } from "./util_simulstor_engine";
import { IESEuclidDistributionItem, IES_LIBRARY } from "@/model/model_parser";

// color map json:
import colormap_gradient from './colormap-gradient.json'
import colormap_solid from './colormap-solid.json'
import colormap_graysccale from './colormap-grayscale.json'


const SURFACE_TESSELLATE_MAX_EDGE_LENGTH: number = 0.1;
const SURFACE_TESSELLATE_MAX_ITERATORS: number = 20;

const COLORMAPS: { [key: string]: number[][] } = { 'gradient': colormap_gradient, 'solid': colormap_solid, 'grayscale': colormap_graysccale };

function createVertexColorAttribute(geom: BufferGeometry): BufferGeometry {
    const colors = new Array(geom.attributes.position.count * 3).fill(0.0);// default color attribute
    geom.setAttribute('color', new Float32BufferAttribute(colors, 3));
    const intensities = new Array(geom.attributes.position.count).fill(0.0);
    geom.setAttribute('intensity', new Float32BufferAttribute(intensities, 1));// save intensity values
    return geom;
}

export function utilThreeSimulatorSceneCreate(simulatorModelScene: ISimulatorScene) {
    const { scene, renderer, raycaster } = utilThreeGetContext();

    // add mouse click events:
    renderer.domElement.addEventListener('mousedown', (event) => {
        const { orbitControls } = utilThreeGetContext();
        if (orbitControls.enabled == false) return;
        if (event.buttons != 1) return;

        simulatorEvent.emit('select_light_id', null);
        let lightGroup: Group = scene.getObjectByName('lightGroup') as Group
        if (!lightGroup) return;
        const intersects = raycaster.intersectObjects([lightGroup], true)
        console.log('intersects=', intersects);
        const intersect = intersects.find(i => i.object && i.object.name == 'light')
        simulatorEvent.emit('select_light_id', intersect?.object.uuid);
    })

    const simulatorThreeScene = scene.getObjectByName('simulator') as Group;

    utilThreeObjectClear(simulatorThreeScene);

    if (!simulatorModelScene || !simulatorModelScene.room || !simulatorModelScene.room.points || simulatorModelScene.room.points.length == 0) return;
    // let points: Vector2Like[] = simulatorModelScene.room.points;
    // console.assert(points.length > 3 && Math2d.isSamePoint(points[0], points[points.length - 1]), ' we need a closed loop for room')

    // const wallHeight = simulatorModelScene.room.height;
    // const wallThickness = simulatorModelScene.room.wall_thickness;
    // if (Math2d.isCCW(points)) points = points.reverse();

    // const ptExtends = Math2d.pointsExtends(points, true, wallThickness, 'left')!

    const room = new Group();
    room.name = 'room';
    //room.rotation.x = toRadian(-90);
    simulatorThreeScene.add(room);

    const planeMaterial = new MeshBasicMaterial({ vertexColors: true, wireframe: false, color: 0xffffff, polygonOffset: true, polygonOffsetFactor: -0.05 });

    for (let i = 0; i < simulatorModelScene.room.walls.length; ++i) {
        const modelWall = simulatorModelScene.room.walls[i];
        //const p0 = points[i], p1 = points[i + 1];
        //let pts = [p0, p1, ptExtends[i + 1], ptExtends[i]];
        let pts = modelWall.walllines;
        const shape: Shape = new Shape(pts.map(pt => new Vector2(pt.x, pt.y)))
        const geom = new ExtrudeGeometry(shape, { bevelEnabled: false, depth: modelWall.height })
        const threeWall: Mesh = new Mesh(geom, new MeshStandardMaterial({ wireframe: false, color: 0x999999 }));
        threeWall.name = 'wall';
        threeWall.uuid = modelWall.uuid;
        threeWall.rotation.x = toRadian(-90);
        room.add(threeWall);

        // build plane:
        const p0 = modelWall.start, p1 = modelWall.end, wallHeight = modelWall.height;
        let planePts: Vector3Like[] = [];
        if (true) {
            // build plane, split points by length:
            const splitCount = Math.floor(Math2d.lineLength(p0, p1) / wallHeight);
            pts = [p0];
            for (let i = 0; i < splitCount; ++i) {
                pts.push(Math2d.lineLerp(p0, p1, (i + 1) / (splitCount + 1)));
            }
            pts.push(p1);

            for (let i = 0; i < pts.length - 1; ++i) {
                const pa = pts[i], pb = pts[i + 1];
                planePts.push(
                    { x: pa.x, y: 0, z: -pa.y }, { x: pb.x, y: 0, z: -pb.y }, { x: pb.x, y: wallHeight, z: -pb.y },
                    { x: pb.x, y: wallHeight, z: -pb.y }, { x: pa.x, y: wallHeight, z: -pa.y }, { x: pa.x, y: 0, z: -pa.y }
                )
            }
            // use the loopSubdivision algorithm:
            //planeGeom = LoopSubdivision.modify(planeGeom, 4, { preserveEdges: true, split: false });
        } else {
            planePts.push(
                { x: p0.x, y: 0, z: -p0.y }, { x: p1.x, y: 0, z: -p1.y }, { x: p1.x, y: wallHeight, z: -p1.y },
                { x: p1.x, y: wallHeight, z: -p1.y }, { x: p0.x, y: wallHeight, z: -p0.y }, { x: p0.x, y: 0, z: -p0.y }
            )
        }

        let planeGeom: BufferGeometry = new BufferGeometry().setFromPoints(planePts.map(pt => new Vector3().copy(pt)));
        //planeGeom = LoopSubdivision.modify(planeGeom, 4, { preserveEdges: true, split: false });
        planeGeom = new TessellateModifier(SURFACE_TESSELLATE_MAX_EDGE_LENGTH, SURFACE_TESSELLATE_MAX_ITERATORS).modify(planeGeom);
        planeGeom = mergeVertices(planeGeom, 0.002);
        createVertexColorAttribute(planeGeom).computeVertexNormals();
        const plane: Mesh = new Mesh(planeGeom, planeMaterial);
        plane.uuid = modelWall.uuid;
        plane.name = 'plane_wall'
        room.add(plane);
    }

    // floor and ceiling:
    const points: IPoint[] = simulatorModelScene.room.points;
    const floorPts2d = points.map(pt => new Vector2(pt.x, pt.y))
    const faces = ShapeUtils.triangulateShape(floorPts2d, [])
    console.log(faces, points)

    const floorPts3d = floorPts2d.map(pt => new Vector3(pt.x, 0, -pt.y));
    let floorGeom: BufferGeometry = new BufferGeometry().setFromPoints(floorPts3d);
    floorGeom.setIndex(_.flatten(faces));
    //floorGeom = LoopSubdivision.modify(floorGeom, 5, { preserveEdges: true, split: true,flatOnly:true });
    floorGeom = new TessellateModifier(SURFACE_TESSELLATE_MAX_EDGE_LENGTH, SURFACE_TESSELLATE_MAX_ITERATORS).modify(floorGeom);
    floorGeom = mergeVertices(floorGeom, 0.002);
    createVertexColorAttribute(floorGeom).computeVertexNormals();
    const floor: Mesh = new Mesh(floorGeom, planeMaterial);
    floor.name = 'plane_floor';
    floor.uuid = simulatorModelScene.room.uuid;
    room.add(floor);


    const ceilingPts3d = floorPts2d.map(pt => new Vector3(pt.x, simulatorModelScene.room.height, -pt.y));
    let ceilingGeom: BufferGeometry = new BufferGeometry().setFromPoints(ceilingPts3d);
    const facesReverse = faces.map(face => [face[0], face[2], face[1]])
    ceilingGeom.setIndex(_.flatten(facesReverse));
    //ceilingGeom = LoopSubdivision.modify(ceilingGeom, 5, { preserveEdges: true, split: true,flatOnly:true });
    ceilingGeom = new TessellateModifier(SURFACE_TESSELLATE_MAX_EDGE_LENGTH, SURFACE_TESSELLATE_MAX_ITERATORS).modify(ceilingGeom);
    ceilingGeom = mergeVertices(ceilingGeom, 0.002);
    createVertexColorAttribute(ceilingGeom).computeVertexNormals();
    const ceiling: Mesh = new Mesh(ceilingGeom, planeMaterial);
    ceiling.name = 'plane_ceiling';
    ceiling.uuid = simulatorModelScene.room.uuid;
    room.add(ceiling);

    simulatorModelScene.lights.forEach(l => utilThreeSimulatorCreateLight(l));

}

export function utilThreeSimulatorCreateLight(light: CSimulatorIES) {
    const { scene } = utilThreeGetContext();
    const simulatorThreeScene = scene.getObjectByName('simulator') as Group;
    let lightGroup: Group = simulatorThreeScene.getObjectByName('lightGroup') as Group
    if (!lightGroup) {
        lightGroup = new Group();
        lightGroup.name = 'lightGroup'
        simulatorThreeScene.add(lightGroup);

        /*const lightBound = new BoxHelper(undefined!, Color.NAMES.pink);
        lightBound.name = 'lightBound';
        lightBound.visible = false;
        lightGroup.add(lightBound)*/
    }
    if (lightGroup.getObjectByName(light.uuid)) throw new Error("try to add light twice");

    const center = new Mesh(new SphereGeometry(0.1, 3, 2), new MeshBasicMaterial({ color: Color.NAMES.yellow, wireframe: true }))
    center.position.set(light.point.x, light.height, -light.point.y)
    center.name = 'light';
    center.uuid = light.uuid;
    lightGroup.add(center)// for test

}

export function utilThreeSimulatorSelectLight(light_id: string) {
    const { scene } = utilThreeGetContext();
    const simulatorThreeScene = scene.getObjectByName('simulator') as Group;

    let lightGroup: Group = simulatorThreeScene.getObjectByName('lightGroup') as Group;
    if (!lightGroup) return;
    const lightBound: BoxHelper = lightGroup.getObjectByName("lightBound") as BoxHelper;
    if (lightBound) lightBound.visible = false;
    if (_.isEmpty(light_id)) return;
    const light = lightGroup.getObjectByProperty('uuid', light_id);
    if (!light) return;
    if (lightBound) lightBound.visible = true;
    if (lightBound) lightBound.setFromObject(light);

}

export function utilThreeSimulatorUpdateLight(simulatorModelScene: ISimulatorScene, light_id: string) {
    const { scene } = utilThreeGetContext();
    const lightModel = simulatorModelScene.lights.find(l => l.uuid == light_id);
    if (!lightModel) return;
    const threeLight: Mesh = utilThreeGetAllObjectsByNames(scene, ['light']).find(l => l.uuid == light_id) as Mesh;
    if (!threeLight) return;
    const threeLightBound = utilThreeGetAllObjectsByNames(scene, ['lightBound'])[0] as BoxHelper

    threeLight.position.set(lightModel.point.x, lightModel.height, -lightModel.point.y);
    //console.log('light position', threeLight.position);

    (threeLight.material as MeshBasicMaterial).color.set(lightModel.on ? Color.NAMES.yellow : Color.NAMES.lightgray);
    threeLightBound?.setFromObject(threeLight)

}


//-----------------
let _maxFloorDistribution: IESEuclidDistributionItem = { intensity: 0, position: new Vector3(), normal: new Vector3() };
let _maxWallDistribution: IESEuclidDistributionItem = { intensity: 0, position: new Vector3(), normal: new Vector3() };


function _utilPlaneVertexAttributeTranverse(callback: (plane: Mesh, position: Float32BufferAttribute, normal: Float32BufferAttribute, color: Float32BufferAttribute, intensity: Float32BufferAttribute) => void): void {
    const { scene } = utilThreeGetContext();
    const planeMeshes: Mesh[] = utilThreeGetAllObjectsByNames(scene, ['plane_wall', 'plane_floor', 'plane_ceiling']) as Mesh[];
    planeMeshes.forEach(planeMesh => {
        const planeGeom = planeMesh.geometry;

        const colorAttr: Float32BufferAttribute = planeGeom.getAttribute('color') as Float32BufferAttribute;
        const positionAttr: Float32BufferAttribute = planeGeom.getAttribute('position') as Float32BufferAttribute;
        const normalAttr: Float32BufferAttribute = planeGeom.getAttribute('normal') as Float32BufferAttribute;
        const intensityAttr: Float32BufferAttribute = planeGeom.getAttribute('intensity') as Float32BufferAttribute;

        if (!colorAttr || !positionAttr || !normalAttr || !intensityAttr) throw new Error("Usage error, no attribute defined")
        if (colorAttr.count != intensityAttr.count) throw new Error("attribute count mismatch.")

        callback(planeMesh, positionAttr, normalAttr, colorAttr, intensityAttr);
    })
}

//-----------------------------

const _tmp_pos: Vector3 = new Vector3();
const _tmp_light_pos_2d: Vector2 = new Vector2();
const _tmp_vertex_pos_2d: Vector2 = new Vector2();
const _tmp_normal: Vector3 = new Vector3();
const _tmp_color: Vector3 = new Vector3();

export function utilThreeGetMaxIntensity(): { wall: IESEuclidDistributionItem, floor: IESEuclidDistributionItem } { return { wall: _maxWallDistribution, floor: _maxFloorDistribution } }

// return the max intensity
export function utilThreeSimulatorUpdatePlaneVertexIntensity(simulatorModelScene: ISimulatorScene): number {
    _maxFloorDistribution.intensity = 0; _maxWallDistribution.intensity = 0;
    const roomPoly: IPoint[] = simulatorModelScene.room.points, roomHeight = simulatorModelScene.room.height;

    const engineLightsScene: ISimulatorEngineLight[] = simulatorModelScene.lights.map(l => {
        return { on: l.on, point: l.point, height: l.height, ies: l.ies, maintenance: l.maintenance };
    });
    // Performance STPE 1: filter light on/off if light is not in room (light in-room culling)
    engineLightsScene.forEach(light => {
        if (!light.on) return;
        light.on = Math2d.pointInPoly(light.point, roomPoly) && light.height < roomHeight && light.height > 0;
    })

    const engineLightsWall: ISimulatorEngineLight[] = _.cloneDeep(engineLightsScene);// used for filter lighs,  VERY important performance improvements, !!!!
    const engineLightsVertex: ISimulatorEngineLight[] = _.cloneDeep(engineLightsWall);// used for filter lights, VERY important performance important !!!!

    _utilPlaneVertexAttributeTranverse((plane, pos, normal, color, intensity) => {
        engineLightsWall.forEach((light, idx) => light.on = engineLightsScene[idx].on);
        const isWall: boolean = plane.name == 'plane_wall';

        // Performance STPE 2: filter lights on/off for the whole wall (wall-light backface culling)
        engineLightsWall.forEach(light => {
            if (!light.on || !isWall) return;
            const wallModel = simulatorModelScene.room.walls.find(w => w.uuid == plane.uuid)!;
            if (!wallModel) throw new Error('can not find model wall');
            light.on = Math2d.whichSidePointOnLine(light.point, wallModel.start, wallModel.end) > 0;// check it!!
        })

        for (let i = 0; i < pos.count; ++i) {

            _tmp_pos.set(pos.getX(i), pos.getY(i), pos.getZ(i));
            _tmp_normal.set(normal.getX(i), normal.getY(i), normal.getZ(i));
            _tmp_vertex_pos_2d.set(_tmp_pos.x, -_tmp_pos.z);

            // use 2d knownledge to filter out the lights for vertices on wall:


            engineLightsVertex.forEach((light, idx) => light.on = engineLightsWall[idx].on);
            // Performance STPE 3: filter light on/off for each vertex (point-walls occlusion culling)
            engineLightsVertex.forEach(light => {
                if (!light.on) return;
                if (isWall) {
                    // wall has special treatments:

                }
                _tmp_light_pos_2d.set(light.point.x, light.point.y);
                _tmp_vertex_pos_2d.lerpVectors(_tmp_vertex_pos_2d, _tmp_light_pos_2d, 0.01);
                // the 2 points(light, vertex) are all in the room polygon, we need to check if the line intersects with wall polyline. if yes, the light is occluded.
                if (light.on && Math2d.isLineSegmentPolylineIntersect(_tmp_light_pos_2d, _tmp_vertex_pos_2d, roomPoly)) light.on = false;
            })

            const intensityVal = utilSimulatorEngineCalculateOnePointIntensity(_tmp_pos, _tmp_normal, engineLightsVertex);
            if (!isWall && plane.name == 'plane_floor' && _maxFloorDistribution.intensity < intensityVal) {
                _maxFloorDistribution.intensity = intensityVal;
                _maxFloorDistribution.position.copy(_tmp_pos);
                _maxFloorDistribution.normal.copy(_tmp_normal);
            } else if (isWall && _maxWallDistribution.intensity < intensityVal) {
                _maxWallDistribution.intensity = intensityVal;
                _maxWallDistribution.position.copy(_tmp_pos);
                _maxWallDistribution.normal.copy(_tmp_normal);
            }
            intensity.setX(i, intensityVal);
        }
        intensity.needsUpdate = true;
    })
    return Math.max(_maxWallDistribution.intensity, _maxFloorDistribution.intensity);
}

export function utilThreeSimulatorUpdatePlaneVertexColor(colormap: string, colorRanges: number[]) {
    const colorSpace = COLORMAPS[colormap];
    if (!colorSpace) throw new Error("useage error, can not find colormap:" + colormap);
    const maxIntensity = Math.max(_maxFloorDistribution.intensity, _maxWallDistribution.intensity);

    _utilPlaneVertexAttributeTranverse((plane, pos, normal, color, intensity) => {

        for (let i = 0; i < color.count; ++i) {
            const colorVal = utilSimulatorEngineCalculateOnePointColor(intensity.getX(i), maxIntensity, colorSpace, colorRanges)
            color.setXYZ(i, colorVal.x, colorVal.y, colorVal.z);
        }

        color.needsUpdate = true;
    });
    simulatorEvent.emit('vertex_color_calc_complete', utilThreeGetMaxIntensity());
}

export function utilThreeSimulatorGetFullRoomDistributionData(): { position: Vector3Like, normal: Vector3Like, distribute: number, uuid: string }[] {
    const data: any[] = [];
    _utilPlaneVertexAttributeTranverse((plane, pos, normal, color, intensity) => {
        for (let i = 0; i < pos.count; ++i) {
            data.push({
                position: { x: pos.getX(i), y: pos.getY(i), z: pos.getZ(i) },
                normal: { x: normal.getX(i), y: normal.getY(i), z: normal.getZ(i) },
                distribute: intensity.getX(i),
                uuid: plane.uuid
            })
        }
    });
    return data;
}