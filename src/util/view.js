/* eslint-disable no-undef */

import { Bound } from "./math";
import 'snapsvg-cjs';

const LAYERS = [
    "grid",
    "wall",
    "dimension",
    "mouse",
    "debug"
];

export const svgEvents = {
    documentOpenBegin: "documentOpenBegin",
    documentOpenEnd: "documentOpenEnd",
    documentChanged: "documentChanged",
    updateLabels: "updateLabels",
    viewportChange: "viewportChange",
    selectedChangeBegin: "selectedChangeBegin", // {detail:<model|null>, event}
    selectedChangeEnd: "selectedChangeEnd",
    documentDataUpdate: "documentDataUpdate",
    mouse: "mouse"
};

/**
 * 
 * @param {*} pathArray [['M', 0, 10], ['L', 100, 10]]
 * @returns 
 */
const pathToString = (pathArray) => {
    let str = ''
    pathArray.forEach(([type, x, y]) => {
        str += `${type}${x} ${y}`
    })
    return str
}

export class SvgView {

    constructor(app, domElement, eventDispatcher, viewName) {
        if (!domElement) throw new Error("domElement missing");

        var context = Snap(domElement);
        var layers = {};

        this.paperWidth = 100;
        this.paperHeight = 100;
        this.name = viewName;
        this.dom = domElement;

        //domElement.appendChild(context.node);
        context.attr("xmlns:xlink", "http://www.w3.org/1999/xlink");
        context.attr({ width: '100%', height: '100%', preserveAspectRatio: "xMidYMid" });
        LAYERS.forEach(layerName => {
            var layer = layers[layerName] = layers[layerName] || context.g();
            layer.attr("type", layerName);
        });
        var svg = context.node;//document;//
        svg.addEventListener('mousewheel', this.onMouseWheel.bind(this));
        svg.addEventListener('mousedown', this.onMouseEvent.bind(this));
        svg.addEventListener('mousemove', this.onMouseEvent.bind(this));
        svg.addEventListener('mouseup', this.onMouseEvent.bind(this));
        svg.addEventListener('click', this.onClick.bind(this));

        this.context = context;
        this.app = app;
        this.eventDispatcher = eventDispatcher;
        this.layers = layers;
        this._circleCalibrate = context.circle(0, 0, 0.00001);
        this.viewport = new Bound();
        this.modelBound = new Bound();
        this.externalSvg = {};
        this.fit(new Bound(0, 0, 2, 2));

        this.loadExternal();
    }

    loadExternal() {
        return;
        Snap.load('/asset/lock.svg', (frag) => this.externalSvg['lock'] = Snap(frag.select('svg')));
        Snap.load('/asset/unlock.svg', (frag) => this.externalSvg['unlock'] = Snap(frag.select('svg')));
    }

    isInBody() {
        let current = this.context.node;
        while (current.parentNode) {
            if (current.parentNode == document.body) return true;
            current = current.parentNode;
        }
        return false;
    }

    clear() {
        LAYERS.forEach(layerName => this.clearLayer(layerName));
        //this.createGrid()
        return this;
    }

    clearLayer(layerName) {
        const layer = this.layers[layerName];
        layer.children().forEach(c => {
            if (!c) return;
            c.attr('eid', '');// eid is special...
            if (c.events) c.events.forEach(e => e.unbind());
        });
        layer.clear()
        return this;
    }

    projectDrawingToDom(point) {
        this._circleCalibrate.attr({ cx: point.x, cy: point.y });
        var domRect = this._circleCalibrate.node.getBoundingClientRect();
        return { x: (domRect.left + domRect.right) / 2, y: (domRect.top + domRect.bottom) / 2 };
    }

    projectDomToDrawing(point) {
        var domRect = this.context.node.getBoundingClientRect();
        var domCenter = { x: (domRect.left + domRect.right) / 2, y: (domRect.top + domRect.bottom) / 2 }
        var vp = this.viewport;
        if (!vp.isValid()) return { x: NaN, y: NaN };
        var scale = { x: domRect.width / vp.width, y: domRect.height / vp.height };
        return { x: (point.x - domCenter.x) / scale.x + vp.x, y: -(point.y - domCenter.y) / scale.y - vp.y };
    }

    onMouseWheel(e) {
        var delta = e.wheelDelta ? (e.wheelDelta / 120) : (-e.detail / 3);
        var mouseX = e.pageX, mouseY = e.pageY;
        this.zoom(delta, { x: mouseX, y: mouseY });
    }

    onMouseEvent(evt) {
        if ((evt.buttons & 4) != 0) {
            this.pan({ x: evt.movementX, y: evt.movementY });
            return;
        }
        if (this.app && this.app.cmdMgr && this.app.cmdMgr.current) this.app.cmdMgr.current.exe(evt);
        this.eventDispatcher.dispatchEvent(new CustomEvent(svgEvents.mouse, { detail: { evt, model: null } }));
    }

    onClick(event) {
        this.eventDispatcher.dispatchEvent(new CustomEvent(svgEvents.selectedChangeBegin, { detail: { event, model: null } }));
    }

    //--------------operators:

    zoom(delta, mousePt) {
        var factor = (delta > 0 ? 0.9 : 1.11);
        if (this.modelBound.isValid() && this.viewport.isValid()) {
            var scaleFactor = Math.min(this.viewport.width / this.modelBound.width, this.viewport.height / this.modelBound.height);
            if (factor > 1 && scaleFactor > 3) return; // can not zoom very small.
        }
        if (!mousePt) mousePt = this.projectDomToDrawing({ x: 0, y: 0 });
        var ptDrawingOld = this.projectDomToDrawing(mousePt);
        this.viewport.width *= factor;
        this.viewport.height *= factor;
        var ptDrawingNew = this.projectDomToDrawing(mousePt);
        this.viewport.x += ptDrawingOld.x - ptDrawingNew.x;
        this.viewport.y -= ptDrawingOld.y - ptDrawingNew.y;
        this._viewportUpdate("zoom");
    }

    pan(deltaPixel) {
        var orig = this.projectDomToDrawing({ x: 0, y: 0 });
        var delta = this.projectDomToDrawing(deltaPixel);
        this.viewport.x -= delta.x - orig.x;
        this.viewport.y += delta.y - orig.y;
        this._viewportUpdate("pan");
    }

    fit(bound) {
        if (bound) {
            this.modelBound.set(bound.x, bound.y, bound.width, bound.height);
            var vp = this.viewport.set(bound.x, bound.y, bound.width, bound.height);
            var domRect = this.context.node.getBoundingClientRect();
            var isVbThin = vp.width / vp.height < domRect.width / domRect.height;
            if (isVbThin) vp.width = domRect.width / domRect.height * vp.height;
            else vp.height = domRect.height / domRect.width * vp.width;
        }
        this._viewportUpdate("fit");
    }

    createGrid(delta = 0.05) {

        const detlaX = delta
        const detlaY = delta
        const minX = -this.paperWidth / 2
        const maxX = this.paperWidth / 2
        const minY = -this.paperHeight / 2
        const maxY = this.paperHeight / 2

        const xLineCount = Math.floor((maxY - minY) / detlaY / 2)
        const yLineCount = Math.floor((maxX - minX) / detlaX / 2)

        const pathArray = []
        for (let i = 0; i <= xLineCount; i++) {
            [detlaX * i, -detlaX * i].forEach(x => pathArray.push(['M', x, minY], ['L', x, maxY]))
        }
        for (let i = 0; i <= yLineCount; i++) {
            [detlaY * i, -detlaY * i].forEach(y => pathArray.push(['M', minX, y], ['L', maxX, y]))
        }
        const gridPath = pathToString(pathArray)
        const grid = this.context.path(gridPath)
        const gridAttr = { stroke: '#bbb', 'stroke-width': 0.3, "vector-effect": "non-scaling-stroke" }
        grid.attr(gridAttr)
        this.layers["grid"].add(grid);

        //main axis:
        const x = this.paperWidth / 2
        const y = this.paperHeight / 2
        var xaxis = this.context.line(-x, 0, x, 0), yaxis = this.context.line(0, y, 0, -y);
        var axisAttr = { stroke: 'black', 'stroke-width': 0.3, "vector-effect": "non-scaling-stroke" };
        xaxis.attr(axisAttr);
        yaxis.attr(axisAttr);
        this.layers["grid"].add(xaxis, yaxis);

        return this;
    }

    //----------------------- private:
    _viewportUpdate(src) {
        var vp = this.viewport;
        this.context.attr("viewBox", `${vp.x - vp.width / 2} ${vp.y - vp.height / 2} ${vp.width} ${vp.height}`);
        this.eventDispatcher.dispatchEvent(new CustomEvent(svgEvents.viewportChange, { detail: src }));
    }
}
