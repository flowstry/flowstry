import { DiagramManager } from "../shapes";


// RenderEngine is responsible for rendering the diagram shapes on svg.
export class RenderEngine {
    private _diagramManager: DiagramManager;

    constructor(diagramManager: DiagramManager) {
        this._diagramManager = diagramManager;
    }
}