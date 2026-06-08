import { Object3DNode, useFrame, useThree, createPortal } from "@react-three/fiber";
import { useMount } from "ahooks";
import { useRef, useState } from "react";
import * as THREE from 'three'
import { ViewHelper } from 'three/examples/jsm/helpers/ViewHelper.js';
export type ViewHelperProps = Object3DNode<ViewHelper, typeof ViewHelper>

let clock: THREE.Clock = new THREE.Clock();

export default () => {
    const { gl, scene: defaultScene, camera: defaultCamera } = useThree();
    const ref = useRef<THREE.Object3D>(null!)
    const [scene] = useState(() => new THREE.Scene())

    useMount(() => {
        const helper: ViewHelper = new ViewHelper(defaultCamera, gl.domElement)
        helper.scale.setScalar(0.8);
        helper.center = defaultCamera.position;
        helper.name = 'helper'
        ref.current.add(helper);
        //ref.current.parent!.remove(ref.current);
    })
    useFrame(({ gl, scene, camera }) => {
        //return;
        const delta = clock.getDelta();
        const viewHelper: ViewHelper = ref.current.getObjectByName('helper') as ViewHelper;
        viewHelper.update(delta);

        gl.clear(true,true)
        gl.autoClear = true
        //gl.render(defaultScene, defaultCamera)
        gl.autoClear = false;
        viewHelper.render(gl);
    })
    return <object3D ref={ref}/>
    return <>{createPortal(<object3D ref={ref}>

    </object3D>,scene)}</>
}