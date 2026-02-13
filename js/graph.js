/**
 * Graph — Layout computation via dagre and graph model state.
 */
window.LineageApp = window.LineageApp || {};

window.LineageApp.Graph = (function () {

    var NODE_WIDTHS = {
        table: 260,
        pipeline: 200,
        dashboard: 220
    };

    var HEADER_HEIGHT = 42;
    var SUBTITLE_HEIGHT = 22;
    var COLUMN_ROW_HEIGHT = 28;
    var COLUMN_PADDING = 8;
    var CHARTS_HEIGHT = 36;
    var DESCRIPTION_HEIGHT = 30;

    /**
     * Estimate the rendered height of a node in its collapsed state.
     */
    function estimateCollapsedHeight(node) {
        var h = HEADER_HEIGHT;
        if (node.type === 'table') {
            h += SUBTITLE_HEIGHT;
        } else if (node.type === 'pipeline') {
            h += SUBTITLE_HEIGHT;
            if (node.description) h += DESCRIPTION_HEIGHT;
        } else if (node.type === 'dashboard') {
            h += SUBTITLE_HEIGHT;
            if (node.charts && node.charts.length > 0) h += CHARTS_HEIGHT;
        }
        return h;
    }

    /**
     * Estimate the rendered height of a table node in its expanded state.
     */
    function estimateExpandedHeight(node) {
        if (node.type !== 'table' || !node.columns) return estimateCollapsedHeight(node);
        var colCount = Math.min(node.columns.length, 10); // max-height caps at ~10 rows visible
        return HEADER_HEIGHT + SUBTITLE_HEIGHT + colCount * COLUMN_ROW_HEIGHT + COLUMN_PADDING;
    }

    /**
     * Compute layout positions for all nodes using dagre.
     * @param {Array} nodes
     * @param {Array} edges
     * @returns {Object} positions keyed by node id: {x, y, width, height}
     */
    function computeLayout(nodes, edges) {
        var g = new dagre.graphlib.Graph();
        g.setGraph({
            rankdir: 'LR',
            nodesep: 60,
            ranksep: 180,
            marginx: 60,
            marginy: 60
        });
        g.setDefaultEdgeLabel(function () { return {}; });

        nodes.forEach(function (node) {
            var w = NODE_WIDTHS[node.type] || 240;
            var h = estimateCollapsedHeight(node);
            g.setNode(node.id, { width: w, height: h });
        });

        edges.forEach(function (edge) {
            g.setEdge(edge.source, edge.target);
        });

        dagre.layout(g);

        var positions = {};
        g.nodes().forEach(function (id) {
            var n = g.node(id);
            positions[id] = {
                x: n.x - n.width / 2,
                y: n.y - n.height / 2,
                width: n.width,
                height: n.height
            };
        });

        return positions;
    }

    // -- Graph Model (state) --

    var state = {
        nodes: [],
        edges: [],
        positions: {},      // {nodeId: {x, y, width, height}}
        expandedNodes: {},   // {nodeId: true}
        nodeMap: {}          // {nodeId: nodeObject}
    };

    function init(data) {
        state.nodes = data.nodes;
        state.edges = data.edges;
        state.expandedNodes = {};
        state.nodeMap = {};
        data.nodes.forEach(function (n) {
            state.nodeMap[n.id] = n;
        });
        state.positions = computeLayout(data.nodes, data.edges);
    }

    function getState() {
        return state;
    }

    function getNodeRect(nodeId) {
        return state.positions[nodeId] || null;
    }

    function setNodePosition(nodeId, x, y) {
        if (state.positions[nodeId]) {
            state.positions[nodeId].x = x;
            state.positions[nodeId].y = y;
        }
    }

    function setNodeHeight(nodeId, height) {
        if (state.positions[nodeId]) {
            state.positions[nodeId].height = height;
        }
    }

    function isExpanded(nodeId) {
        return !!state.expandedNodes[nodeId];
    }

    function toggleExpanded(nodeId) {
        if (state.expandedNodes[nodeId]) {
            delete state.expandedNodes[nodeId];
            return false;
        }
        state.expandedNodes[nodeId] = true;
        return true;
    }

    function expandAll() {
        state.nodes.forEach(function (n) {
            if (n.type === 'table') {
                state.expandedNodes[n.id] = true;
            }
        });
    }

    function collapseAll() {
        state.expandedNodes = {};
    }

    /**
     * Get all edges connected to a node (as source or target).
     */
    function getEdgesForNode(nodeId) {
        return state.edges.filter(function (e) {
            return e.source === nodeId || e.target === nodeId;
        });
    }

    /**
     * Get column mappings that involve a specific source node and column.
     * Searches through pipeline edges to find column-level lineage.
     */
    function getColumnLineage(sourceNodeId, columnName) {
        var results = [];
        state.edges.forEach(function (edge) {
            if (!edge.columnMapping || edge.columnMapping.length === 0) return;
            edge.columnMapping.forEach(function (cm) {
                if (cm.sourceNode === sourceNodeId && cm.sourceColumn === columnName) {
                    results.push({
                        edgeId: edge.id,
                        sourceNode: cm.sourceNode,
                        sourceColumn: cm.sourceColumn,
                        targetNode: edge.target,
                        targetColumn: cm.targetColumn,
                        pipelineNode: edge.source
                    });
                }
            });
        });
        return results;
    }

    /**
     * Get all column mappings for a target node and column.
     */
    function getColumnLineageReverse(targetNodeId, columnName) {
        var results = [];
        state.edges.forEach(function (edge) {
            if (edge.target !== targetNodeId) return;
            if (!edge.columnMapping || edge.columnMapping.length === 0) return;
            edge.columnMapping.forEach(function (cm) {
                if (cm.targetColumn === columnName) {
                    results.push({
                        edgeId: edge.id,
                        sourceNode: cm.sourceNode,
                        sourceColumn: cm.sourceColumn,
                        targetNode: targetNodeId,
                        targetColumn: cm.targetColumn,
                        pipelineNode: edge.source
                    });
                }
            });
        });
        return results;
    }

    return {
        computeLayout: computeLayout,
        estimateCollapsedHeight: estimateCollapsedHeight,
        estimateExpandedHeight: estimateExpandedHeight,
        init: init,
        getState: getState,
        getNodeRect: getNodeRect,
        setNodePosition: setNodePosition,
        setNodeHeight: setNodeHeight,
        isExpanded: isExpanded,
        toggleExpanded: toggleExpanded,
        expandAll: expandAll,
        collapseAll: collapseAll,
        getEdgesForNode: getEdgesForNode,
        getColumnLineage: getColumnLineage,
        getColumnLineageReverse: getColumnLineageReverse
    };
})();
