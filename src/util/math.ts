/* eslint-disable @typescript-eslint/no-unused-expressions */

import _ from "lodash";

interface IPoint { x: number; y: number }
interface ILine {
    p1?: IPoint;
    p2?: IPoint;
}
const DEFAULT_TOLERANCE: number = 0.0001; // 0.1mm

export const Math2d = {
    toRaduis: (angleDegree: number) => angleDegree * Math.PI / 180,
    toDegree: (angleRadians: number) => angleRadians * 180 / Math.PI,

    equals: function (a: number, b: number, tolerance: number = 0.0005): boolean {
        return Math.abs(a - b) <= (tolerance); // 0.5mm
    },
    vectorRotate: function (vec: IPoint, angle: number/*radius*/) {
        var cos = Math.cos(angle);
        var sin = Math.sin(angle);
        var newX = vec.x * cos - vec.y * sin;
        var newY = vec.y * cos + vec.x * sin;
        return { x: newX, y: newY };
    },
    rotatePointCW: function (base: IPoint, your: IPoint, degree: number) {
        if (Math2d.isSamePoint(base, your, DEFAULT_TOLERANCE)) return base;
        var vec = Math2d.sub(your, base);
        var rot = Math2d.vectorRotate(vec, Math2d.toRaduis(degree))
        return Math2d.add(rot, base);
    },
    getScaledPoint: function (base: IPoint, your: IPoint, expectedLength: number) {
        var lerp = expectedLength / Math2d.lineLength(base, your);
        return { x: base.x + lerp * (your.x - base.x), y: base.y + lerp * (your.y - base.y) };
    },
    dot: function (v1: IPoint, v2: IPoint) {
        return v1.x * v2.x + v1.y * v2.y;
    },
    cross: function (v1: IPoint, v2: IPoint) {
        return v1.x * v2.y - v1.y * v2.x;
    },
    sub: function (pt1: IPoint, pt2: IPoint) {
        return { x: pt1.x - pt2.x, y: pt1.y - pt2.y };
    },
    add: function (pt1: IPoint, pt2: IPoint) {
        return { x: pt1.x + pt2.x, y: pt1.y + pt2.y };
    },
    lineLength: function (pt1: IPoint, pt2: IPoint) {
        var diff = Math2d.sub(pt1, pt2);
        return Math.sqrt(Math2d.dot(diff, diff));
    },
    lineLerp: function (pt1: IPoint, pt2: IPoint, lerpNumber: number): IPoint {
        return Math2d.getScaledPoint(pt1, pt2, Math2d.lineLength(pt1, pt2) * lerpNumber);
    },
    isSamePoint: function (pt1: IPoint, pt2: IPoint, tol: number = DEFAULT_TOLERANCE) {
        return Math2d.lineLength(pt1, pt2) < tol;
    },
    simplyPolygon: function (polygon: IPoint[], tol: number) {
        var simplePoly: IPoint[] = [];
        var polyAdd: IPoint | undefined;
        polygon.forEach(function (pt: IPoint) {
            if (polyAdd && Math2d.isSamePoint(polyAdd, pt, tol))
                return;
            polyAdd = pt;
            simplePoly.push(polyAdd);
        });
        if (polyAdd && Math2d.isSamePoint(polyAdd, simplePoly[0], tol))
            simplePoly.pop();
        return simplePoly;
    },
    getPolygonArea: function (polygon: IPoint[]) {
        var sum = 0;
        for (var i = 0; i < polygon.length; i++) {
            var p1 = polygon[i];
            var p2 = polygon[(i >= (polygon.length - 1)) ? 0 : (i + 1)];
            sum += (p1.x * p2.y - p1.y * p2.x);
        }
        return Math.abs(sum * 0.5);
    },

    getBound: function (polygon: IPoint[], offsetFactor?: number) {
        if (offsetFactor === undefined) {
            offsetFactor = 0;
        }
        var pt0 = polygon[0];
        var minx = pt0.x;
        var maxx = pt0.x;
        var miny = pt0.y;
        var maxy = pt0.y;
        for (var i = 1; i < polygon.length; i++) {
            var _a = polygon[i], x = _a.x, y = _a.y;
            minx = Math.min(minx, x);
            maxx = Math.max(maxx, x);
            miny = Math.min(miny, y);
            maxy = Math.max(maxy, y);
        }
        var width = maxx - minx;
        var height = maxy - miny;
        var offsetX = offsetFactor * width;
        var offsetY = offsetFactor * height;
        return {
            x: minx - offsetX / 2, y: miny - offsetY / 2,
            width: width + offsetX, height: height + offsetY,
            centerX: (minx + maxx) / 2, centerY: (miny + maxy) / 2
        };
    },
    polyMassCenter: function (poly: IPoint[]): IPoint | undefined {
        var isClosed = Math2d.isSamePoint(poly[0], poly[poly.length - 1], .01);
        var cnt = poly.length;
        if (cnt == 0) return undefined;
        else if (cnt == 1) return poly[0];
        else if (cnt == 2 || (isClosed == true && cnt == 3)) {
            return { x: (poly[0].x + poly[1].x) / 2, y: (poly[0].y + poly[1].y) / 2 };
        }
        if (!isClosed) poly.push(poly[0]);

        var a = 0, x = 0, y = 0;
        for (var i = 0; i < poly.length - 1; ++i) {
            var p0 = poly[i], p1 = poly[i + 1];
            var dot = (p0.x * p1.y) - (p1.x * p0.y);
            x += (p0.x + p1.x) * dot, y += (p0.y + p1.y) * dot, a += dot;
        }
        return { x: x / (a * 3), y: y / (a * 3) };
    },
    isCCW: function (polygon: IPoint[]) {
        let len = polygon.length;
        if (len < 3) {
            return false;
        }
        for (var n = 0, r = 0, a = len - 1; r < len; ++r)
            n += (polygon[a].x + polygon[r].x) * (polygon[a].y - polygon[r].y),
                a = r;
        return 0.5 * -n > 0;
    },
    // 判断点是否在线段上
    isPointInLine(pt: IPoint, start: IPoint, end: IPoint, tol = 0.01) {
        let intPt = Math2d.getPerpendicularIntersect(pt, start, end);
        let len1 = Math2d.lineLength(start, end);
        let len2 = Math2d.lineLength(intPt, start);
        let len3 = Math2d.lineLength(intPt, end);
        let len4 = Math2d.lineLength(intPt, pt);
        return len2 <= (len1 + tol) && len3 <= (len1 + tol) && len4 <= tol;
    },
    // 判断线是否平行
    isLinesParallel(pt1: IPoint, pt2: IPoint, pt3: IPoint, pt4: IPoint, tol: number = 1e-2) {
        return Math.abs((pt1.x - pt2.x) * (pt3.y - pt4.y) - (pt1.y - pt2.y) * (pt3.x - pt4.x)) <= tol
    },
    poinToLineLength: function (pt: IPoint, start: IPoint, end: IPoint) {
        let intPt = Math2d.getPerpendicularIntersect(pt, start, end);
        return Math2d.lineLength(pt, intPt);
    },
    linePolygonIntersect(a1: IPoint, a2: IPoint, b: IPoint[]): false | IPoint[] {
        var length = b.length;
        const intersectPoints: IPoint[] = [];

        for (var i = 0; i < length; ++i) {
            var b1 = b[i];
            var b2 = b[(i + 1) % length];

            if (Math2d.isLinesIntersect(a1, a2, b1, b2))
                intersectPoints.push(Math2d.lineLineIntersection(a1, a2, b1, b2))
        }

        return intersectPoints.length == 0 ? false : intersectPoints;
    },
    // 判断线是否相交
    isLinesIntersect(a1: IPoint, a2: IPoint, b1: IPoint, b2: IPoint) {
        // b1->b2向量 与 a1->b1向量的向量积
        var ua_t = (b2.x - b1.x) * (a1.y - b1.y) - (b2.y - b1.y) * (a1.x - b1.x);
        // a1->a2向量 与 a1->b1向量的向量积
        var ub_t = (a2.x - a1.x) * (a1.y - b1.y) - (a2.y - a1.y) * (a1.x - b1.x);
        // a1->a2向量 与 b1->b2向量的向量积
        var u_b = (b2.y - b1.y) * (a2.x - a1.x) - (b2.x - b1.x) * (a2.y - a1.y);
        // u_b == 0时，角度为0或者180 平行或者共线不属于相交
        if (u_b !== 0) {
            var ua = ua_t / u_b;
            var ub = ub_t / u_b;

            if (0 <= ua && ua <= 1 && 0 <= ub && ub <= 1) {
                return true;
            }
        }

        return false;
    },
    // 多边形与多边形
    polygonPolygonIntersect(a: IPoint[], b: IPoint[]): boolean {
        var i, l;

        // a的每条边与b的每条边做相交检测
        for (i = 0, l = a.length; i < l; ++i) {
            var a1 = a[i];
            var a2 = a[(i + 1) % l];

            if (Math2d.linePolygonIntersect(a1, a2, b))
                return true;
        }

        // 判断两个多边形的包含关系
        for (i = 0, l = b.length; i < l; ++i) {
            if (Math2d.pointInPoly(b[i], a))
                return true;
        }

        // 判断两个多边形的包含关系
        for (i = 0, l = a.length; i < l; ++i) {
            if (Math2d.pointInPoly(a[i], b))
                return true;
        }
        return false;
    },
    polygonExtends(a: IPoint[], extend: number): IPoint[] {
        if (a.length < 3) return a;
        let points = (a || []).slice();
        let lines: (ILine & { dir: IPoint })[] = [];
        let isCCW = false;
        if (Math2d.isCCW(points)) {
            points.reverse();
            isCCW = true;
        }
        for (let i = 0; i < points.length; i++) {
            let p1 = points[i];
            let p2 = points[(i + 1) % points.length];
            let rz = Math2d.getAngleHorizontaleCCW(p1, p2);
            let dir = {
                x: Math.sin(rz / 180 * Math.PI),
                y: Math.cos(rz / 180 * Math.PI) * -1
            }
            if (!Math2d.isSamePoint(p1, p2)) {
                lines.push({ p1, p2, dir });
            }
        }
        // 合并共线
        let index: number = 0;
        while (index < lines.length) {
            let currentWall = lines[index];
            let next = (index + 1) % lines.length;
            let nextWall = lines[next];
            if (Math2d.isLinesParallel(currentWall.p1!, currentWall.p2!, nextWall.p1!, nextWall.p2!)) {
                currentWall.p2 = nextWall.p2;
                lines.splice(next, 1)
            } else {
                index++;
            }
        }

        lines = lines.map(e => {
            const { p1, p2, dir } = e;
            e.p1 = Math2d.getScaledPoint(p1!, { x: p1!.x - dir.x, y: p1!.y - dir.y }, extend);
            e.p2 = Math2d.getScaledPoint(p2!, { x: p2!.x - dir.x, y: p2!.y - dir.y }, extend);
            return e;
        })

        // 取线的交点
        let innerPoints: IPoint[] = [];

        for (let i = 0; i < lines.length; i++) {
            let line1 = lines[i];
            let line2 = lines[(i + 1) % lines.length];
            let intPoint = Math2d.lineLineIntersection(line1.p1!, line1.p2!, line2.p1!, line2.p2!);
            intPoint.x = +intPoint.x.toFixed(3);
            intPoint.y = +intPoint.y.toFixed(3);
            innerPoints.push(intPoint);
        }
        innerPoints = [innerPoints[innerPoints.length - 1], ...innerPoints.slice(0, innerPoints.length - 1)];
        if (isCCW) {
            innerPoints.reverse();
        }
        return innerPoints.filter(e => !!e);

    },
    getLerpNumber: function (start: IPoint, end: IPoint, pt: IPoint) {
        let intPt = Math2d.getPerpendicularIntersect(pt, start, end);
        return Math.abs(start.x - end.x) > Math.abs(start.y - end.y) ? (intPt.x - start.x) / (end.x - start.x) : (intPt.y - start.y) / (end.y - start.y)
    },
    //线与线的交点
    lineLineIntersection(pt1: IPoint, pt2: IPoint, pt3: IPoint, pt4: IPoint) {
        var r = 1 / ((pt1.x - pt2.x) * (pt3.y - pt4.y) - (pt1.y - pt2.y) * (pt3.x - pt4.x))
            , a = pt1.x * pt2.y - pt1.y * pt2.x
            , s = pt3.x * pt4.y - pt3.y * pt4.x;
        return {
            x: (a * (pt3.x - pt4.x) - (pt1.x - pt2.x) * s) * r,
            y: (a * (pt3.y - pt4.y) - (pt1.y - pt2.y) * s) * r
        }
    },
    // 点的投影是否在线段上
    isPerpendicularPointInLineSegment: function (pt: IPoint, start: IPoint, end: IPoint): boolean {
        let intPt = Math2d.getPerpendicularIntersect(pt, start, end);
        return Math2d.isPointInLine(intPt, start, end);
    },
    //线到点垂足
    getPerpendicularIntersect(pt: IPoint, start: IPoint, end: IPoint): IPoint {
        const dx = start.x - end.x;
        const dy = start.y - end.y;
        if (Math2d.isSamePoint(start, end)) {
            return start;
        }
        let u = (pt.x - start.x) * (start.x - end.x) + (pt.y - start.y) * (start.y - end.y);

        u = u / (Math.pow(dx, 2) + Math.pow(dy, 2));

        let cx = (start.x + u * dx);
        let cy = (start.y + u * dy);
        return { x: cx, y: cy }
    },
    getAngleHorizontaleCCW: function (base: IPoint, your: IPoint) {
        var vec = Math2d.sub(your, base);
        return Math2d.toDegree(Math.atan2(vec.y, vec.x));
    },
    //点是否落在多段线的某条边上
    isPointInPolyline(point: IPoint, polyline: IPoint[], tol: number = 0.01): boolean {
        for (var i = 0, j = polyline.length - 1; i < polyline.length; j = i++) {
            if (Math2d.isPointInLine(point, polyline[i], polyline[j], tol)) {
                return true;
            }
        }
        return false;
    },
    // 点是否在多边形内
    // isPointInPolygon(pt: IPoint, poly: IPoint[]): boolean {
    //     if (!poly || poly.length < 3) return false; // not a polygon.
    //     for (var c = false, i = -1, l = poly.length, j = l - 1; ++i < l; j = i)
    //         ((poly[i].y <= pt.y && pt.y < poly[j].y) || (poly[j].y <= pt.y && pt.y < poly[i].y))
    //             && (pt.x < (poly[j].x - poly[i].x) * (pt.y - poly[i].y) / (poly[j].y - poly[i].y) + poly[i].x)
    //             && (c = !c);
    //     return c;
    // },
    pointInPoly(point: IPoint, polygon: IPoint[]): boolean {
        var x = point.x, y = point.y;
        var inside: boolean = false;
        for (var i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            var xi = polygon[i].x, yi = polygon[i].y;
            var xj = polygon[j].x, yj = polygon[j].y;
            var intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside || Math2d.isPointInPolyline(point, polygon);
    },
    pointsExtends(points: IPoint[], isClosed: boolean, extendsLength: number, extendsDirection: string = 'left' /* right or left */): IPoint[] | undefined {
        if (!points || points.length < 2) {
            console.error("INVALID input points.");
            return undefined;
        }
        if (Array.isArray(extendsLength)) {
            console.assert(points.length == extendsLength.length + 1, "Error: Invalid extendsLength array.");
        }

        var first: any = points[0], last: any = points[points.length - 1];
        if (isClosed === true && !Math2d.isSamePoint(first, last)) {
            console.error("USAGE error, the first point and last point should be the same one..");
            return undefined;
        }
        if (points.length == 2 && Math2d.isSamePoint(first, last)) {
            console.error("the points can not be a line. Need line points.");
            return [first, last];
        }

        var lines: any[] = [];
        for (var i = 0; i < points.length - 1; ++i) {
            var begin = points[i], end = points[i + 1];
            var extendLength = (Array.isArray(extendsLength) ? extendsLength[i] : extendsLength) || 0;
            if (Math2d.isSamePoint(begin, end)) continue;
            var beginExtend = Math2d.getScaledPoint(begin,
                Math2d.rotatePointCW(begin, end, extendsDirection == "left" ? 90 : -90)
                , extendLength);
            var endExtend = Math2d.getScaledPoint(end,
                Math2d.rotatePointCW(end, begin, extendsDirection == "left" ? -90 : 90)
                , extendLength);

            if (beginExtend && endExtend && isFinite(beginExtend.x) && isFinite(endExtend.x)) {
                lines.push({ p0: beginExtend, p1: endExtend });
            }
        }

        var resultPts = [];
        var first: any = lines[0], last: any = lines[lines.length - 1];
        if (!first || !first.p1 || !last || !last.p1) return undefined;
        var isFirstLastParallel = Math2d.isLinesParallel(first.p0, first.p1, last.p0, last.p1);

        // first point:
        resultPts.push(isClosed && !isFirstLastParallel ? Math2d.lineLineIntersection(first.p0, first.p1, last.p0, last.p1) : first.p0);
        // middle point:
        for (var i = 0; i < lines.length - 1; ++i) {
            var line0 = lines[i], line1 = lines[(i + 1) % lines.length];
            if (Math2d.isLinesParallel(line0.p0, line0.p1, line1.p0, line1.p1)) resultPts.push(line0.p1);
            else resultPts.push(Math2d.lineLineIntersection(line0.p0, line0.p1, line1.p0, line1.p1));
        }
        // last point:
        resultPts.push(isClosed && !isFirstLastParallel ? Math2d.lineLineIntersection(first.p0, first.p1, last.p0, last.p1) : last.p1);
        return resultPts;
    },

    /**
     * 
     * @param your 
     * @param lineStart 
     * @param lineEnd 
     * @returns number [0,1,-1]
     */
    whichSidePointOnLine(your: IPoint, lineStart: IPoint, lineEnd: IPoint): number {
        var p0 = lineStart, p1 = lineEnd, p = your;
        var delta = (p1.y - p0.y) * p.x - (p1.x - p0.x) * p.y + (p1.x * p0.y - p1.y * p0.x);
        return Math2d.equals(delta, 0) ? 0 : (delta > 0 ? 1 : -1);
    },

    /**
     * 已知两个polygon相邻但不相交,求相邻的公共边
     * @param poly1 
     * @param poly2 
     * @param tol
     * @returns 多段线的点集, 若不相邻则返回undefined
     */
    getPolygonIntersectLine(poly1: IPoint[], poly2: IPoint[], tol: number = 0.01): IPoint[] | undefined {
        let intersectPts: IPoint[] = [];
        let polyline: IPoint[] = [];
        poly1.forEach(pt => { if (Math2d.isPointInPolyline(pt, poly2, tol)) intersectPts.push(pt) })
        poly2.forEach(pt => { if (Math2d.isPointInPolyline(pt, poly1, tol)) intersectPts.push(pt) })
        intersectPts = _.uniqWith(intersectPts, (a, b) => Math2d.isSamePoint(a, b))
        const startIndex: number = poly1.findIndex((pt: IPoint, idx: number) => {
            const ptNext: IPoint = poly1[idx + 1];
            return ptNext && intersectPts.filter(p => Math2d.isPointInLine(p, pt, ptNext, tol)).length == 0;// no point is in this line.
        });
        console.assert(startIndex != -1, "Error: find start index ==-1 !!")
        for (var i = 0; i < poly1.length; ++i) {
            const p0 = poly1[(startIndex + i) % poly1.length], p1 = poly1[(startIndex + i + 1) % poly1.length];
            const pts = intersectPts.filter(p => Math2d.isPointInLine(p, p0, p1, tol));
            pts.sort((a, b) => Math2d.lineLength(p0, a) - Math2d.lineLength(p0, b));
            polyline = polyline.concat(pts);
        }
        polyline = _.uniqWith(polyline, (a, b) => Math2d.isSamePoint(a, b))
        return polyline.length > 0 ? polyline : undefined;
    },

    // 平行线投影长度
    getParallelLinesShadowLength(pt1: IPoint, pt2: IPoint, pt3: IPoint, pt4: IPoint) {
        if (Math2d.isPerpendicularPointInLineSegment(pt1, pt3, pt4) && Math2d.isPerpendicularPointInLineSegment(pt2, pt3, pt4)) {
            return Math2d.lineLength(pt1, pt2);
        } else if (Math2d.isPerpendicularPointInLineSegment(pt3, pt1, pt2) && Math2d.isPerpendicularPointInLineSegment(pt4, pt1, pt2)) {
            return Math2d.lineLength(pt3, pt4);
        } else {
            let shadowPoints: IPoint[] = [];
            if (Math2d.isPerpendicularPointInLineSegment(pt1, pt3, pt4)) {
                shadowPoints.push(Math2d.getPerpendicularIntersect(pt1, pt3, pt4))
            }
            if (Math2d.isPerpendicularPointInLineSegment(pt2, pt3, pt4)) {
                shadowPoints.push(Math2d.getPerpendicularIntersect(pt2, pt3, pt4))
            }
            if (Math2d.isPerpendicularPointInLineSegment(pt3, pt1, pt2)) {
                shadowPoints.push(Math2d.getPerpendicularIntersect(pt3, pt1, pt2))
            }
            if (Math2d.isPerpendicularPointInLineSegment(pt4, pt1, pt2)) {
                shadowPoints.push(Math2d.getPerpendicularIntersect(pt4, pt1, pt2))
            }

            if (shadowPoints.length <= 1) {
                return 0;
            } else {
                return Math2d.lineLength(shadowPoints[0], shadowPoints[1]);
            }
        }
    },

    isLineSegmentPolylineIntersect(line_p0: IPoint, line_p1: IPoint, poly: IPoint[]): boolean {
        console.assert(poly.length > 3, 'poly is not valid');
        const isClose = Math2d.isSamePoint(poly[0], poly[poly.length - 1]);// todo: add logic if not close
        for (let i = 0; i < poly.length - 1; ++i) {
            const p0 = poly[i], p1 = poly[i + 1];
            if (Math2d.whichSidePointOnLine(p0, line_p0, line_p1) != Math2d.whichSidePointOnLine(p1, line_p0, line_p1) &&
                Math2d.whichSidePointOnLine(line_p0, p0, p1) != Math2d.whichSidePointOnLine(line_p1, p0, p1)) return true;
        }
        return false;
    }

};

export class Bound {
    /** Center X */
    public x: number;
    /** Center Y */
    public y: number;
    public width: number;
    public height: number;
    /**
     *
     * @param x center x
     * @param y center y
     * @param width
     * @param height
     */
    constructor(x: number = NaN, y: number = NaN, width: number = -Infinity, height: number = -Infinity) {
        this.x = isFinite(x) ? x : NaN;  // center x
        this.y = isFinite(y) ? y : NaN;  // center y
        this.width = isFinite(width) ? width : 0;
        this.height = isFinite(height) ? height : 0;
    }
    reset() {
        this.x = NaN, this.y = NaN, this.width = 0, this.height = 0;
        return this;
    }
    center() { return { x: this.x, y: this.y } }

    addPoint(point: IPoint) {
        if (!isFinite(this.x) || isNaN(this.y)) {
            this.x = point.x;
            this.y = point.y;
            return this;
        }
        var minx = Math.min(point.x, this.x - this.width / 2);
        var maxx = Math.max(point.x, this.x + this.width / 2);
        var miny = Math.min(point.y, this.y - this.height / 2);
        var maxy = Math.max(point.y, this.y + this.height / 2);

        this.x = (minx + maxx) / 2;
        this.y = (miny + maxy) / 2;
        this.width = maxx - minx;
        this.height = maxy - miny;
        return this;
    }

    addPoints(points: IPoint[] | undefined) {
        points && points.forEach((pt: IPoint) => this.addPoint(pt));
        return this;
    }

    addMargin(offset: number) {
        this.width += offset;
        this.height += offset;
        return this;
    }

    clone() {
        return new Bound(this.x, this.y, this.width, this.height);
    }

    set(x: number, y: number, width: number, height: number) {
        if (isFinite(x)) this.x = x;
        if (isFinite(y)) this.y = y;
        if (isFinite(width)) this.width = width;
        if (isFinite(height)) this.height = height;
        return this;
    }

    isValid() {
        return isFinite(this.x) && isFinite(this.y) && isFinite(this.width) && isFinite(this.height);
    }

    containsPoint(pt: IPoint) {
        var minx = this.x - this.width / 2;
        var maxx = this.x + this.width / 2;
        var miny = this.y - this.height / 2;
        var maxy = this.y + this.height / 2;
        return pt.x >= minx && pt.x <= maxx && pt.y >= miny && pt.y <= maxy;
    }
    getPolygon(): IPoint[] {
        // this first point is topLeft.
        var center = this.center(), width = this.width, height = this.height;
        var points = [[-1, 1], [-1, -1], [1, -1], [1, 1], [-1, 1]].map(pos => {
            return { x: center.x + pos[0] * width / 2, y: center.y + pos[1] * height / 2 };
        });
        return points;
    }
    equals(another: Bound, tol: number = 0.1): boolean {
        return Math.abs(this.x - another.x) < tol &&
            Math.abs(this.y - another.y) < tol &&
            Math.abs(this.width - another.width) < tol &&
            Math.abs(this.height - another.height) < tol;
    }
}

export class OBB {
    public bound: Bound;
    public angle: number;

    constructor(bound: Bound, angle: number = 0) {
        this.bound = bound;
        this.angle = angle || 0;
    }

    getPolygon() {
        var center = this.bound.center();
        var points = this.bound.getPolygon().map((pt: IPoint) => Math2d.rotatePointCW(center, pt, this.angle));
        return points;
    }
    set(x: number, y: number, width: number, height: number, angle: number) {
        this.bound.set(x, y, width, height);
        this.angle = angle || 0;
        return this;
    }
    center(): IPoint { return this.bound.center(); }
}

export function fixedNumber(number: number, figure: number = 2) {
    return parseFloat(number.toFixed(figure))
}