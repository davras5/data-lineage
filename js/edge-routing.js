/**
 * Edge Routing — Bezier curve computation for table-level and column-level edges.
 */
window.LineageApp = window.LineageApp || {};

window.LineageApp.EdgeRouting = (function () {

    /**
     * Compute a cubic bezier SVG path from the right edge of source to left edge of target.
     * @param {{x:number, y:number, width:number, height:number}} src - source node rect
     * @param {{x:number, y:number, width:number, height:number}} tgt - target node rect
     * @returns {string} SVG path d attribute
     */
    function computeEdgePath(src, tgt) {
        var x1 = src.x + src.width;
        var y1 = src.y + src.height / 2;
        var x2 = tgt.x;
        var y2 = tgt.y + tgt.height / 2;

        var dx = Math.max(Math.abs(x2 - x1) * 0.5, 60);
        return 'M ' + x1 + ' ' + y1 +
               ' C ' + (x1 + dx) + ' ' + y1 +
               ', ' + (x2 - dx) + ' ' + y2 +
               ', ' + x2 + ' ' + y2;
    }

    /**
     * Compute a cubic bezier SVG path between two port positions (column-level).
     * @param {{x:number, y:number}} from
     * @param {{x:number, y:number}} to
     * @returns {string} SVG path d attribute
     */
    function computeColumnEdgePath(from, to) {
        var dx = Math.max(Math.abs(to.x - from.x) * 0.4, 40);
        return 'M ' + from.x + ' ' + from.y +
               ' C ' + (from.x + dx) + ' ' + from.y +
               ', ' + (to.x - dx) + ' ' + to.y +
               ', ' + to.x + ' ' + to.y;
    }

    /**
     * Get the graph-space position of a column port element.
     * @param {string} nodeId
     * @param {string} columnName
     * @param {'left'|'right'} side
     * @param {{translateX:number, translateY:number, scale:number}} transform - current pan/zoom
     * @returns {{x:number, y:number}|null}
     */
    function getColumnPortPosition(nodeId, columnName, side, transform) {
        var nodeEl = document.querySelector('[data-node-id="' + nodeId + '"]');
        if (!nodeEl) return null;

        var colEl = nodeEl.querySelector('[data-column="' + columnName + '"]');
        if (!colEl) return null;

        var portEl = colEl.querySelector('.node__column-port--' + side);
        if (!portEl) return null;

        var portRect = portEl.getBoundingClientRect();
        var containerRect = document.getElementById('graph-container').getBoundingClientRect();

        var graphX = (portRect.left + portRect.width / 2 - containerRect.left - transform.translateX) / transform.scale;
        var graphY = (portRect.top + portRect.height / 2 - containerRect.top - transform.translateY) / transform.scale;

        return { x: graphX, y: graphY };
    }

    /**
     * Get the center-left or center-right position of a node in graph space.
     * @param {{x:number, y:number, width:number, height:number}} nodeRect
     * @param {'left'|'right'} side
     * @returns {{x:number, y:number}}
     */
    function getNodeEdgeCenter(nodeRect, side) {
        if (side === 'right') {
            return { x: nodeRect.x + nodeRect.width, y: nodeRect.y + nodeRect.height / 2 };
        }
        return { x: nodeRect.x, y: nodeRect.y + nodeRect.height / 2 };
    }

    return {
        computeEdgePath: computeEdgePath,
        computeColumnEdgePath: computeColumnEdgePath,
        getColumnPortPosition: getColumnPortPosition,
        getNodeEdgeCenter: getNodeEdgeCenter
    };
})();
