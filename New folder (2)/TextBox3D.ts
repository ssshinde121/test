import * as THREE from 'three';

import Canvas from "../Managers/Canvas";
import CutViewManager from "../Managers/CutViewManager";
import SelectionManager from "../Managers/SelectionManager";
import ModelManager from "../Managers/ModelManager";
import Logger from "../Developement/Logger";

class TextBox3D {

    private width: number = 0;
    private height: number = 0;
    private size: number = 0.5;
    private backgroundColor: string = "#ffffff";
    private textColor: string = "#000000";
    private textPadding: number = 40;
    private GPUSceneMesh: THREE.Mesh = new THREE.Mesh();

    public id: any;     // number | undefined
    public text: string;
    public twoFaced: boolean;
    public position: THREE.Vector3 = new THREE.Vector3();
    public quaternion: THREE.Quaternion = new THREE.Quaternion();
    public object3D: THREE.Object3D = new THREE.Object3D();
    public canvas: any;
    public selectTarget: any;

    constructor(text: string = "", twoFaced: boolean = true) {

        this.text = text;
        this.twoFaced = twoFaced;
        this.selectTarget = undefined;

    }

    // Update the displayed text
    update(text = this.text): void {
        // Update property if changed
        this.text = text;

        // Clean out the container object
        this.object3D.children.splice(0, this.object3D.children.length);

        // Create text canvas
        this.canvas = this._getCanvasWithMeasurementText(text, this.backgroundColor, this.textColor);

        // Set public properties
        this.width = this.size * this.canvas.width / 100;
        this.height = this.size * this.canvas.height / 100;

        // Create texture out of the canvas
        let texture = new THREE.Texture(this.canvas);
        texture.needsUpdate = true;
        texture.minFilter = THREE.LinearFilter;

        // Create material with texture
        var material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true
        });
        material.side = THREE.FrontSide;
        material.clippingPlanes = CutViewManager.cutPlanes;

        // Create mesh objects for rendering
        var mesh = new THREE.Mesh(new THREE.PlaneGeometry(this.width, this.height), material);
        var meshBackside = new THREE.Mesh(new THREE.PlaneGeometry(this.width, this.height), material);

        // Rotate backside 180 degrees
        meshBackside.applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 180 * THREE.MathUtils.DEG2RAD, 0)));


        // Add meshes as children
        this.object3D.add(mesh);
        if (this.twoFaced) { this.object3D.add(meshBackside); }

        // Set ID from child to allow GPUPicking override
        this.id = this.object3D.children[0].id;

        // Create gpu picking object to make it selectable
        this._createGPUPickingObject();

        // Set initial rotation
        this.setRotation(this.quaternion);

        // Set GPU scene dirty for selection to work
        Canvas.SetSceneDirty();
    }

    dispose(): void {
        // Remove object and gpu object from their scenes/parents
        if (this.object3D.parent) { this.object3D.parent.remove(this.object3D); }
        SelectionManager.GPUPickingScene.remove(this.GPUSceneMesh);

        // Remove gpu picking reference
        if (ModelManager.OriginalObjectAndIdMapping[this.id]) {
            delete ModelManager.OriginalObjectAndIdMapping[this.id];
        }

        // Remove internal references
        this.id = undefined;
        this.object3D.remove();             // this.object3D = undefined;
        this.GPUSceneMesh.remove();         // this._GPUSceneMesh = undefined;
    }

    setPosition(xOrVector, y, z): void {
        if (xOrVector instanceof THREE.Vector3) {
            this.object3D.position.copy(xOrVector);
            this.GPUSceneMesh.position.copy(xOrVector);
            this.position.copy(xOrVector);
        } else {
            this.object3D.position.set(xOrVector, y, z);
            this.GPUSceneMesh.position.set(xOrVector, y, z);
            this.position.set(xOrVector, y, z);
        }
        this.object3D.updateMatrixWorld();
        this._updateGPUPickingObject();
    }

    setRotation(quaternion = this.quaternion): void {
        this.object3D.quaternion.copy(quaternion);
        let up = new THREE.Vector3(0, 1, 0);
        up.applyQuaternion(quaternion);

        this._updateGPUPickingObject();
    }

    rotateBox(axis, angle): void {
        this.object3D.rotateOnAxis(axis, angle);
        // this.object3D.updateMatrixWorld();
        // this.object3D.updateMatrix();
    }

    lookAt(Vector3): void {
        this.object3D.lookAt(Vector3);
        // this.object3D.updateMatrixWorld();
        // this.object3D.updateMatrix();
    }

    /**
     * Generates a canvas object displaying the text passed as parameter.
     * @param {string} text 
     * @param {string / THREE.Color} backgroundColor 
     * @param {string / THREE.Color} textColor 
     */
    _getCanvasWithMeasurementText(text, backgroundColor, textColor) {
        // Parse parameters
        let bgColor = typeof backgroundColor === "string" ? new THREE.Color(backgroundColor) : backgroundColor;
        let txColor = typeof textColor === "string" ? new THREE.Color(textColor) : textColor;
        let font = '48px arial';

        // Create canvas element
        var canvas = document.createElement('canvas');

        // Get canvas context
        var ctx = canvas.getContext('2d');

        // Get canvas and text width
        var widths = this._measureText(text);
        let textCanvasWidth = widths.canvasWidth;
        var textWidth = widths.textWidth;

        var height = 64;
        canvas.width = textCanvasWidth;
        canvas.height = height;

        // Fill canvas context
        if (ctx != null) {
            ctx.fillStyle = "rgba(" + Math.round(bgColor.r * 255) + "," + Math.round(bgColor.g * 255) + "," + Math.round(bgColor.b * 255) + "," + 1.0 + ")";
            ctx.lineWidth = 2;
            ctx.strokeStyle = "blue";
            this._roundRect(ctx, 0, 0, textCanvasWidth, height, 12);
            ctx.fillStyle = "rgba(" + Math.round(txColor.r * 255) + "," + Math.round(txColor.g * 255) + "," + Math.round(txColor.b * 255) + "," + 1.0 + ")";

            ctx.textBaseline = 'top';
            ctx.font = font;
            ctx.fillText(text, (textCanvasWidth / 2) - (textWidth / 2), (height / 2) - 24);
            ctx.restore();
        }

        return canvas;
    }

    _createGPUPickingObject(): void {
        if (!this.object3D) { return; }

        this._updateGPUPickingObject();

        if (ModelManager.OriginalObjectAndIdMapping[this.id] === undefined) {
            ModelManager.OriginalObjectAndIdMapping[this.id] = this.selectTarget ? this.selectTarget : this;
        } else {
            Logger.log("Object with id: " + this.id + " already exists in OriginalObjectAndIdMapping", Logger.LogType.WARNING);
        }
    }

    _updateGPUPickingObject(): void {
        if (this.GPUSceneMesh) {
            SelectionManager.GPUPickingScene.remove(this.GPUSceneMesh);
        }
        let measurementId = this.id;

        let geometry = this.object3D.children[0].geometry;
        let material = new THREE.MeshBasicMaterial();

        let idcolor = new THREE.Color();
        idcolor.setHex(measurementId);

        // material.color = [];
        material.color.r = idcolor.r;
        material.color.g = idcolor.g;
        material.color.b = idcolor.b;

        material.side = THREE.DoubleSide;

        this.GPUSceneMesh = new THREE.Mesh(geometry, material);

        this.object3D.children[0].updateMatrixWorld();

        if (this.object3D.children[0].parent != null) {
            this.object3D.children[0].parent.updateMatrixWorld();
        }

        this.GPUSceneMesh.matrix.copy(this.object3D.children[0].matrixWorld);
        this.GPUSceneMesh.matrixAutoUpdate = false;
        this.GPUSceneMesh.updateMatrixWorld();

        SelectionManager.GPUPickingScene.add(this.GPUSceneMesh);
    }

    /**
     * Calculates the width of the canvas and the text
     * @param {string} text
     * @returns {textWidth & canvasWidth} object
     */
    _measureText(text) {
        let font = '48px arial';

        let canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 128;

        let ctx = canvas.getContext('2d');

        if (ctx != null) {
            ctx.save();
            ctx.font = font;

            ctx.textBaseline = 'top';
            ctx.fillStyle = "#FF8080";
            let width = ctx.measureText(text).width;
        }

        return {
            canvasWidth: this.width + this.textPadding,
            textWidth: this.width
        };
    }

    /**
     * function for drawing rounded rectangles on canvas
     */
    _roundRect(ctx, x, y, w, h, r): void {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        ctx.fill();
    }

}

export default TextBox3D;