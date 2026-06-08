
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ViewHelper } from 'three/examples/jsm/helpers/ViewHelper.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import {
    Vector3Like, Box3Helper, BoxGeometry, BoxHelper, Group, LineBasicMaterial, BufferGeometry,
    Float32BufferAttribute, GridHelper, LineSegments, Mesh, MeshBasicMaterial, SphereGeometry,
    Vector3, Object3D, PerspectiveCamera, Scene, WebGLRenderer, Raycaster, Vector2
} from 'three';

// color map json:
import colormap_gradient from './colormap-gradient.json'
import colormap_solid from './colormap-solid.json'
import colormap_graysccale from './colormap-grayscale.json'
import { IES, IESPolarDistributionItem } from '@/model/model_parser';
import { utilIESGetContext, utilIESGetPointIntensity, utilIESSetContext } from './util_ies';
import _ from 'lodash';
import { linearProject, toRadian } from './common';
import { simulatorEvent } from '@/model/model_simulator';

export interface IThreeInit {
    camera: PerspectiveCamera,
    scene: Scene,
    renderer: WebGLRenderer,
    controls: OrbitControls
}

const COLORMAPS: { [key: string]: number[][] } = { 'gradient': colormap_gradient, 'solid': colormap_solid, 'grayscale': colormap_graysccale };
const DEFAULT_SPHERE_WIDTH_SEGMENTS: number = 360 //8;//
const DEFAULT_SPHERE_HEIGHT_SEGMENTS: number = 180 //6;//

const _Vector3_ZERO: Vector3 = new Vector3(0, 0, 0);

// iesData:
let roomDistributionFullData: { index: number, position: Vector3Like, normal: Vector3Like, distribute: IESPolarDistributionItem }[];

// three js objects:
let camera: PerspectiveCamera;
let scene: Scene;
let renderer: WebGLRenderer;
let orbitControls: OrbitControls;
let clock: THREE.Clock = new THREE.Clock();
let stats: Stats = new Stats();
let viewHelper: ViewHelper;
let raycaster = new Raycaster(), mousePointer = new Vector2();
let transformControls: TransformControls;

export const utilThreeGetContext = () => (Object.assign({ raycaster, camera, scene, renderer, transformControls, orbitControls, roomDistributionFullData }, utilIESGetContext()));

if (process.env.NODE_ENV == 'development') {
    (window as any).utilThreeGetContext = utilThreeGetContext
}


const _tmp_dir: Vector3 = new Vector3();
const _tmp_normal: Vector3 = new Vector3();

export function utilThreeInit(canvas: HTMLCanvasElement): IThreeInit {

    const bound = canvas.getBoundingClientRect();

    camera = new PerspectiveCamera(45, bound.width / bound.height, 0.1, 200);
    const cameraPos = { x: 0, y: 10, z: 10 };
    camera.position.set(cameraPos.x, cameraPos.y, cameraPos.z);
    camera.lookAt(0, 0, 0);

    //renderer:
    renderer = new WebGLRenderer({ antialias: true, canvas });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(bound.width, bound.height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;

    // scene:
    scene = new Scene();
    scene.background = new THREE.Color(0xcccccc);
    scene.fog = new THREE.Fog(0x050505, 2000, 3500);
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    //scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), -0.04).texture

    const light = new THREE.HemisphereLight(0x202020, 0xefefef, 2);
    light.position.set(0, 15, 0);
    //scene.add(light);

    //scene.add(new THREE.AxesHelper(0.2));

    orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
    orbitControls.dampingFactor = 0.1;
    //controls.autoRotate = true;
    orbitControls.screenSpacePanning = false;
    orbitControls.target.set(0, 0, 0);
    orbitControls.minDistance = 2;
    orbitControls.maxDistance = 50;
    orbitControls.maxPolarAngle = Math.PI;
    orbitControls.update();

    // view helper:
    viewHelper = new ViewHelper(camera, renderer.domElement);
    viewHelper.scale.setScalar(0.8);
    viewHelper.center = orbitControls.target;


    transformControls = new TransformControls(camera, renderer.domElement);
    transformControls.setMode('translate');
    transformControls.enabled = false;
    scene.add(transformControls);
    transformControls.addEventListener('mouseDown', () => {
        orbitControls.enabled = false;
    })
    transformControls.addEventListener('mouseUp', () => {
        orbitControls.enabled = true;
    })
    transformControls.addEventListener('change', () => {
        simulatorEvent.emit('object_transform_change', transformControls)
    })

    //if (process.env.REACT_APP_NAME == 'parser') utilThreeInitParserScene();
    //else utilThreeInitSimulatorScene();

    renderer.domElement.addEventListener('mousemove', (event) => {
        const bound = renderer.domElement.getBoundingClientRect();
        mousePointer.set((event.clientX - bound.left) / bound.width * 2 - 1, -(event.clientY - bound.top) / bound.height * 2 + 1)
    })

    animate();

    if (process.env.NODE_ENV == 'development') {
        canvas.parentNode?.appendChild(stats.dom);
    }

    const rv = { camera, scene, renderer, controls: orbitControls }
    return rv;
}

export function utilThreeInitSimulatorScene() {

    const grid = new GridHelper(30, 30, 0x222222, 0x888888);
    grid.name = 'grid'
    scene.add(grid)

    const model = new THREE.Group();
    model.name = 'simulator';
    scene.add(model);

    scene.add(new THREE.AmbientLight(0x666666, 1));

    const light = new THREE.PointLight(0xffffff, 6, 0, 0);
    light.position.set(20, 20, 35);
    scene.add(light);

    const light2 = new THREE.PointLight(0xaaaaaa, 4, 0, 0);
    light2.position.set(-20, -10, -10);
    scene.add(light2);

}

export function utilThreeInitParserScene() {

    const grid = new GridHelper(2, 4);
    grid.name = 'grid'
    scene.add(grid)
    // scene structure - sphere

    const sphereGroup = new Group();
    sphereGroup.name = 'sphereGroup';
    sphereGroup.rotation.x = toRadian(180);
    //sphereGroup.rotation.y = toRadian(90);
    scene.add(sphereGroup);

    const center = new Mesh(new SphereGeometry(0.1, 3, 2), new MeshBasicMaterial({ color: 0xffff00, wireframe: true }))
    center.name = 'center';
    sphereGroup.add(center)// for test

    const sphere = new Mesh(undefined, new MeshBasicMaterial({ wireframe: false, side: THREE.FrontSide, color: THREE.Color.NAMES['white'], vertexColors: true, opacity: 0.6, transparent: false }));
    sphere.name = 'sphere';
    sphereGroup.add(sphere);

    const sphereLine = new LineSegments(undefined, new LineBasicMaterial({ color: THREE.Color.NAMES['gray'] }));
    sphereLine.name = 'sphereLine';
    sphereGroup.add(sphereLine);

    const sphereCenterToGroundLine = new LineSegments(undefined, new LineBasicMaterial({ color: THREE.Color.NAMES['yellow'] }));
    sphereCenterToGroundLine.name = 'sphereCenterToGroundLine';
    sphereGroup.add(sphereCenterToGroundLine);


    const sphereActiveLongitudeLine = new LineSegments(undefined, new LineBasicMaterial({ color: THREE.Color.NAMES['red'] }));
    sphereActiveLongitudeLine.name = 'sphereActiveLongitudeLine';
    sphereGroup.add(sphereActiveLongitudeLine);


    // build geometry:
    const sphereGeom = new THREE.SphereGeometry(1, DEFAULT_SPHERE_WIDTH_SEGMENTS, DEFAULT_SPHERE_HEIGHT_SEGMENTS);

    const colors = [];// default color attribute
    for (let i = 0, n = sphereGeom.attributes.position.count; i < n; ++i)  colors.push(i > n / 2 ? 1 : 1, 1, 1);
    sphereGeom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    sphere.geometry = sphereGeom;

    // lines: default 10 degrees
    const indices: number[] = [];//utilThreeShowSphereLatitudeLongitude(10, sphereGeom.parameters.widthSegments, sphereGeom.parameters.heightSegments);
    let lineGeom = new BufferGeometry();
    lineGeom.setAttribute('position', sphereGeom.getAttribute('position'));
    lineGeom.setIndex(indices);
    sphereLine.geometry = lineGeom;

    lineGeom = new BufferGeometry();
    lineGeom.setAttribute('position', sphereGeom.getAttribute('position'));
    lineGeom.setIndex(indices);
    sphereActiveLongitudeLine.geometry = lineGeom;


    // rooms:
    const roomGroup = new Group();
    roomGroup.name = 'roomGroup';
    scene.add(roomGroup);

    const room = new Mesh(undefined, new MeshBasicMaterial({ vertexColors: true, wireframe: false, color: 0xFFFFFF, side: THREE.BackSide, polygonOffset: true }))
    room.name = 'room';
    roomGroup.add(room);

    const roomBound = new BoxHelper(room);
    roomBound.name = 'roomBound';
    roomGroup.add(roomBound);
}


function animate() {
    requestAnimationFrame(animate);
    render();
    stats.update();

}

function render() {
    const time = 0.01;
    const delta = clock.getDelta();
    orbitControls.update();
    if (viewHelper.animating === true) viewHelper.update(delta);
    raycaster.setFromCamera(mousePointer, camera)

    renderer.render(scene, camera);
    renderer.autoClear = false;
    viewHelper.render(renderer);
    renderer.autoClear = true;
}

//-------------------
// three js extends:
export function utilThreeObjectClear(group: Object3D) {
    group.traverse(function (obj: any) {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
    })
    group.children.slice(0).forEach(child => group.remove(child));
}

export function utilThreeGetAllObjectsByNames(group: Object3D, names: string[]): Object3D[] {
    const nodes: Object3D[] = [];
    group.traverse(function (obj: any) {
        if (names.includes(obj.name)) nodes.push(obj);
    });
    return nodes;
}


//-------------------------------------
// ies specified:
//


export function utilThreeSetIES(_ies: IES) {
    utilIESSetContext(_ies)
}

export function utilThreeShowSphereLatitudeLongitude(interval: number, widthSegments: number = DEFAULT_SPHERE_WIDTH_SEGMENTS, heightSegments: number = DEFAULT_SPHERE_HEIGHT_SEGMENTS): any {
    // assume sphere is 180x360
    const lineMesh: LineSegments = scene.getObjectByName('sphereGroup')?.getObjectByName('sphereLine') as LineSegments;
    if (!lineMesh) return;
    const lineGeom = lineMesh.geometry;
    const positionBuffer = lineGeom.getAttribute('position');
    if (positionBuffer.array.length / positionBuffer.itemSize != (widthSegments + 1) * (heightSegments + 1)) return console.error("build line segment error, count mismatch");

    console.log('interval=', interval);

    const indices: number[] = [];
    for (let i = interval; i < heightSegments; i += interval) {// horizental lines:
        for (let j = 0; j < widthSegments; ++j) {
            indices.push((widthSegments + 1) * i + j, (widthSegments + 1) * i + j + 1);
        }
    }

    for (let i = 0; i < widthSegments; i += interval) {//vertical lines:
        for (let j = 0; j < heightSegments; ++j) {
            indices.push((widthSegments + 1) * j + i, (widthSegments + 1) * (j + 1) + i)
        }
    }
    lineGeom.setIndex(indices);
    return indices;
}

export function utilThreeSetSphereColormap(colormap: string, colorRange: number[]) {
    const iesFullData = utilIESGetContext().tensor;
    if (!iesFullData) return;
    const colorSpace = COLORMAPS[colormap];
    if (!colorSpace) throw new Error("useage error, can not find colormap:" + colormap);
    const maxIntensity = Math.log2(Math.max(..._.flatten(iesFullData)));

    const sphereMesh: Mesh = scene.getObjectByName('sphereGroup')?.getObjectByName('sphere') as Mesh;
    if (!sphereMesh) return;
    const sphereGeom: SphereGeometry = sphereMesh.geometry as SphereGeometry;
    const colorBuffer: THREE.Float32BufferAttribute = sphereGeom.getAttribute('color')! as THREE.Float32BufferAttribute;
    const widthSegments = sphereGeom.parameters.widthSegments, heightSegments = sphereGeom.parameters.heightSegments;

    const intensityRange = colorRange.map(num => maxIntensity * num / 100);
    for (let i = 0; i <= widthSegments; ++i) {
        for (let j = 0; j <= heightSegments; ++j) {
            const colorIndex = Math.round(linearProject(intensityRange, [0, colorSpace.length], Math.log2(iesFullData[i][j])));
            const color = colorSpace[Math.max(0, Math.min(colorIndex, colorSpace.length - 1))];
            colorBuffer.setXYZ(j * (widthSegments + 1) + i, color[0], color[1], color[2]);
        }
    }
    colorBuffer.needsUpdate = true;
}

export function utilThreeSetCurrentLongitude(lontitude: number, widthSegments: number = DEFAULT_SPHERE_WIDTH_SEGMENTS, heightSegments: number = DEFAULT_SPHERE_HEIGHT_SEGMENTS) {
    const lineMesh: LineSegments = scene.getObjectByName('sphereGroup')?.getObjectByName('sphereActiveLongitudeLine') as LineSegments;
    if (!lineMesh) return;
    const lineGeom = lineMesh.geometry;
    const positionBuffer = lineGeom.getAttribute('position');
    if (positionBuffer.array.length / positionBuffer.itemSize != (widthSegments + 1) * (heightSegments + 1)) return console.error("build line segment error, count mismatch");

    const indices: number[] = [];
    for (let i = 0; i < widthSegments; i += 1) {//vertical lines:
        if (i != lontitude && i != (180 + lontitude) % 360) continue;
        for (let j = 0; j < heightSegments; ++j) {
            indices.push((widthSegments + 1) * j + i, (widthSegments + 1) * (j + 1) + i)
        }
    }
    lineGeom.setIndex(indices);
}


export function utilThreeSetSphereVisible(visible: boolean) {
    const sphereGroup = scene?.getObjectByName("sphereGroup")!;
    sphereGroup?.children.forEach(child => {
        if (!['sphereCenterToGroundLine', 'center'].includes(child.name)) child.visible = visible;
    })
    //if (visible) controls.target.copy(sphereGroup.position);
    //else controls.target.copy(_Vector3_ZERO);
}

export function utilThreeSetLightHeight(height3d: number) {
    const sphereGroup = scene?.getObjectByName("sphereGroup");
    sphereGroup?.position.setY(height3d);
    orbitControls.target.setY(height3d);
    // todo recompute ground colors:
    if (sphereGroup) {
        const lineMesh: LineSegments = sphereGroup.getObjectByName('sphereCenterToGroundLine') as LineSegments;
        if (lineMesh) lineMesh.geometry = new BufferGeometry().setFromPoints([_Vector3_ZERO, sphereGroup.position!]);
    }
    if (utilIESGetContext().ies) {
        roomDistributionFullData = [];
        _calcRoomIntensityDistribution((index, pos, norm, intensity) => roomDistributionFullData.push({ index, distribute: intensity, position: { x: pos.x, y: pos.y, z: pos.z }, normal: { x: norm.x, y: norm.y, z: norm.z } }))
    }
}

//-----------------------
// rooms api:
export function utilThreeSetRoomVisible(visible: boolean) {
    const roomGroup = scene?.getObjectByName("roomGroup");
    if (roomGroup) roomGroup.visible = visible;
}
export function utilThreeSetGridVisible(visible: boolean) {
    const grid = scene?.getObjectByName("grid");
    if (grid) grid.visible = visible;
}

/** build room geometry and room data, for input parameters, it's Z-up , but for threejs boxgeometry, it is Y-up */
export function utilThreeBuildRoom(gridInterval: number, xlen: number, ylen: number, zlen: number, centerX: number, centerZ: number) {
    console.log("buildRoom");
    // set default value:
    gridInterval = gridInterval || 0.1;
    xlen = xlen || 4;
    ylen = ylen || 4;
    zlen = zlen || 4;
    centerX = centerX || 0;
    centerZ = centerZ || 0;

    const roomGroup = scene?.getObjectByName("roomGroup")!
    const roomMesh: Mesh = roomGroup.getObjectByName("room") as Mesh;
    const roomGeom = new BoxGeometry(xlen, ylen, zlen, Math.round(xlen / gridInterval), Math.round(ylen / gridInterval), Math.round(zlen / gridInterval));
    roomMesh.geometry = roomGeom;
    roomMesh.position.set(centerX / 2, ylen / 2, centerZ / 2);

    const roomBound: BoxHelper = roomGroup.getObjectByName('roomBound') as BoxHelper;
    roomBound.update();

    const colors = [];// default color attribute
    for (let i = 0, n = roomGeom.attributes.position.count; i < n; ++i)  colors.push(i > n / 2 ? 1 : 1, 1, 1);
    roomGeom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    if (utilIESGetContext().ies) {
        roomDistributionFullData = [];
        _calcRoomIntensityDistribution((index, pos, norm, intensity) => roomDistributionFullData.push({ index, distribute: intensity, position: { x: pos.x, y: pos.y, z: pos.z }, normal: { x: norm.x, y: norm.y, z: norm.z } }))
    }
}

const _calcRoomIntensityDistribution = (function () {
    const posVec: Vector3 = new Vector3();
    const normalVec: Vector3 = new Vector3();

    return function (stepCallback?: (index: number, pos: Vector3, norm: Vector3, intensity: IESPolarDistributionItem) => void,
        completeCallback?: (distributions: IESPolarDistributionItem[]) => void) {
        const roomMesh: Mesh = scene?.getObjectByName("roomGroup")!.getObjectByName("room") as Mesh;
        const sphereGroup = scene?.getObjectByName("sphereGroup")!;

        const roomGeom: BoxGeometry = roomMesh.geometry as BoxGeometry;
        const posAttr: Float32BufferAttribute = roomGeom.getAttribute('position') as Float32BufferAttribute;
        const normalAttr: Float32BufferAttribute = roomGeom.getAttribute('normal') as Float32BufferAttribute;

        if (!posAttr || !normalAttr) return;

        const distributions: IESPolarDistributionItem[] = [];
        for (let i = 0; i < posAttr.array.length / posAttr.itemSize; ++i) {
            posVec.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
            posVec.applyMatrix4(roomMesh.matrix);
            normalVec.set(normalAttr.getX(i), normalAttr.getY(i), normalAttr.getZ(i)).negate();// we use backface culling, so need to negate the vector.
            const dist = utilIESGetPointIntensity(undefined, sphereGroup?.position, posVec, normalVec);
            distributions.push(dist);
            if (stepCallback) stepCallback(i, posVec, normalVec, dist);
        }
        if (completeCallback) completeCallback(distributions)
    }
})()

export function utilThreeSetRoomColormap(colormap: string, colorRange: number[]) {
    //return;
    if (!roomDistributionFullData || roomDistributionFullData.length == 0) return;

    const colorSpace = COLORMAPS[colormap];
    if (!colorSpace) throw new Error("useage error, can not find colormap:" + colormap);

    const maxIntensity = Math.log2(Math.max(0, ...roomDistributionFullData.map(d => d.distribute.intensity)));
    const intensityRange = colorRange.map(num => maxIntensity * num / 100);

    const roomMesh: Mesh = scene?.getObjectByName("roomGroup")!.getObjectByName("room") as Mesh;
    const roomGeom: BoxGeometry = roomMesh.geometry as BoxGeometry;
    const colorAttr: Float32BufferAttribute = roomGeom.getAttribute('color') as Float32BufferAttribute;
    if (!colorAttr) return;

    for (let i = 0; i < roomDistributionFullData.length; ++i) {
        const data = roomDistributionFullData[i];
        console.assert(i == data.index, "mismatch, check it!!")
        const colorIndex = Math.round(linearProject(intensityRange, [0, colorSpace.length], Math.log2(data.distribute.intensity)));
        const color = colorSpace[Math.max(0, Math.min(colorIndex, colorSpace.length - 1))];
        colorAttr.setXYZ(i, color[0], color[1], color[2]);
    }
    colorAttr.needsUpdate = true;
}

export function utilThreeGetFullRoomDistributionData() { return roomDistributionFullData; }


export function utilThreeGetRoomMaxDistribution(normal?: Vector3Like): { position: Vector3Like, intensity: IESPolarDistributionItem } {
    let maxPos: Vector3Like = _Vector3_ZERO;
    const rv: { position: Vector3Like, intensity: IESPolarDistributionItem } = { position: maxPos, intensity: { intensity: -1, latitude: -1, longitude: -1, distance: -1 } };
    if (!roomDistributionFullData) return rv;

    for (let i = 0; i < roomDistributionFullData.length; ++i) {
        const data = roomDistributionFullData[i];
        if (normal && Math.abs(_tmp_normal.copy(normal).dot(data.normal)) < 0.1) continue;
        if (data.distribute.intensity > rv.intensity.intensity) { rv.intensity = data.distribute; rv.position = data.position; }
    }

    return rv;
}