/**
 * Interactions — Pan, zoom, drag, expand/collapse, highlighting.
 */
window.LineageApp = window.LineageApp || {};

window.LineageApp.Interactions = (function () {

    var Graph = window.LineageApp.Graph;
    var Renderer = window.LineageApp.Renderer;
    var EdgeRouting = window.LineageApp.EdgeRouting;

    var container = null;
    var transformLayer = null;
    var zoomLevelEl = null;

    var translateX = 0;
    var translateY = 0;
    var scale = 1;

    var MIN_SCALE = 0.15;
    var MAX_SCALE = 2.5;
    var ZOOM_STEP = 0.1;

    // Pan state
    var isPanning = false;
    var panStartX = 0;
    var panStartY = 0;
    var panStartTranslateX = 0;
    var panStartTranslateY = 0;

    // Drag state
    var isDragging = false;
    var dragNodeId = null;
    var dragStartX = 0;
    var dragStartY = 0;
    var dragNodeStartX = 0;
    var dragNodeStartY = 0;
    var dragNodeEl = null;

    // Column highlight state
    var highlightedColumn = null;

    function getTransform() {
        return { translateX: translateX, translateY: translateY, scale: scale };
    }

    function applyTransform() {
        transformLayer.style.transform = 'translate(' + translateX + 'px, ' + translateY + 'px) scale(' + scale + ')';
        if (zoomLevelEl) {
            zoomLevelEl.textContent = Math.round(scale * 100) + '%';
        }
    }

    function init() {
        container = document.getElementById('graph-container');
        transformLayer = document.getElementById('transform-layer');
        zoomLevelEl = document.getElementById('zoom-level');

        // Pan
        container.addEventListener('pointerdown', onPanStart);
        window.addEventListener('pointermove', onPanMove);
        window.addEventListener('pointerup', onPanEnd);

        // Zoom
        container.addEventListener('wheel', onWheel, { passive: false });

        // Node interactions (delegated)
        var nodeLayer = document.getElementById('node-layer');
        nodeLayer.addEventListener('pointerdown', onNodePointerDown);
        nodeLayer.addEventListener('click', onNodeClick);

        // Clear highlights on background click
        container.addEventListener('click', onContainerClick);

        // Toolbar buttons
        document.getElementById('btn-zoom-in').addEventListener('click', zoomIn);
        document.getElementById('btn-zoom-out').addEventListener('click', zoomOut);
        document.getElementById('btn-fit').addEventListener('click', fitToScreen);
        document.getElementById('btn-reset').addEventListener('click', resetLayout);
        document.getElementById('btn-expand-all').addEventListener('click', onExpandAll);
        document.getElementById('btn-collapse-all').addEventListener('click', onCollapseAll);

        applyTransform();
    }

    // ---- Pan ----

    function onPanStart(e) {
        // Only pan from background — skip if clicking on a node
        if (e.target.closest('.node')) return;
        // Skip if clicking toolbar buttons
        if (e.target.closest('.toolbar')) return;

        isPanning = true;
        panStartX = e.clientX;
        panStartY = e.clientY;
        panStartTranslateX = translateX;
        panStartTranslateY = translateY;
        container.classList.add('is-panning');
        container.setPointerCapture(e.pointerId);
        e.preventDefault();
    }

    function onPanMove(e) {
        if (isPanning) {
            translateX = panStartTranslateX + (e.clientX - panStartX);
            translateY = panStartTranslateY + (e.clientY - panStartY);
            applyTransform();
        }
        if (isDragging) {
            onDragMove(e);
        }
    }

    function onPanEnd(e) {
        if (isPanning) {
            isPanning = false;
            container.classList.remove('is-panning');
        }
        if (isDragging) {
            onDragEnd(e);
        }
    }

    // ---- Zoom ----

    function onWheel(e) {
        e.preventDefault();
        var zoomFactor = e.deltaY > 0 ? 0.92 : 1.08;
        var newScale = clamp(scale * zoomFactor, MIN_SCALE, MAX_SCALE);

        var rect = container.getBoundingClientRect();
        var mx = e.clientX - rect.left;
        var my = e.clientY - rect.top;

        translateX = mx - (mx - translateX) * (newScale / scale);
        translateY = my - (my - translateY) * (newScale / scale);
        scale = newScale;

        applyTransform();
        // Recompute column edges since port positions depend on zoom
        Renderer.renderColumnEdges(getTransform());
    }

    function zoomIn() {
        var rect = container.getBoundingClientRect();
        var cx = rect.width / 2;
        var cy = rect.height / 2;
        var newScale = clamp(scale + ZOOM_STEP, MIN_SCALE, MAX_SCALE);
        translateX = cx - (cx - translateX) * (newScale / scale);
        translateY = cy - (cy - translateY) * (newScale / scale);
        scale = newScale;
        applyTransform();
        Renderer.renderColumnEdges(getTransform());
    }

    function zoomOut() {
        var rect = container.getBoundingClientRect();
        var cx = rect.width / 2;
        var cy = rect.height / 2;
        var newScale = clamp(scale - ZOOM_STEP, MIN_SCALE, MAX_SCALE);
        translateX = cx - (cx - translateX) * (newScale / scale);
        translateY = cy - (cy - translateY) * (newScale / scale);
        scale = newScale;
        applyTransform();
        Renderer.renderColumnEdges(getTransform());
    }

    function fitToScreen() {
        var state = Graph.getState();
        var positions = state.positions;
        var nodeIds = Object.keys(positions);
        if (nodeIds.length === 0) return;

        // Update node heights from DOM
        nodeIds.forEach(function (id) {
            Renderer.updateNodeRectFromDOM(id);
        });

        var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        nodeIds.forEach(function (id) {
            var p = positions[id];
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x + p.width);
            maxY = Math.max(maxY, p.y + p.height);
        });

        var graphW = maxX - minX;
        var graphH = maxY - minY;
        var rect = container.getBoundingClientRect();
        var padding = 60;

        var scaleX = (rect.width - padding * 2) / graphW;
        var scaleY = (rect.height - padding * 2) / graphH;
        scale = clamp(Math.min(scaleX, scaleY), MIN_SCALE, MAX_SCALE);

        translateX = (rect.width - graphW * scale) / 2 - minX * scale;
        translateY = (rect.height - graphH * scale) / 2 - minY * scale;

        applyTransform();
        // Wait for transform to apply, then re-render column edges
        requestAnimationFrame(function () {
            Renderer.renderColumnEdges(getTransform());
        });
    }

    function resetLayout() {
        var state = Graph.getState();
        Graph.collapseAll();
        var newPositions = Graph.computeLayout(state.nodes, state.edges);
        Object.keys(newPositions).forEach(function (id) {
            state.positions[id] = newPositions[id];
        });
        Renderer.renderAllNodes();
        Renderer.renderAllEdges();
        Renderer.clearHighlights();
        fitToScreen();
    }

    // ---- Node Drag ----

    function onNodePointerDown(e) {
        var header = e.target.closest('.node__header');
        if (!header) return;

        // Don't drag if clicking expand button
        if (e.target.closest('[data-action="toggle-expand"]')) return;

        var nodeEl = header.closest('.node');
        if (!nodeEl) return;

        var nodeId = nodeEl.getAttribute('data-node-id');
        if (!nodeId) return;

        isDragging = true;
        dragNodeId = nodeId;
        dragNodeEl = nodeEl;
        dragStartX = e.clientX;
        dragStartY = e.clientY;

        var pos = Graph.getNodeRect(nodeId);
        dragNodeStartX = pos.x;
        dragNodeStartY = pos.y;

        dragNodeEl.classList.add('is-dragging');
        e.preventDefault();
        e.stopPropagation();
    }

    function onDragMove(e) {
        if (!isDragging || !dragNodeId) return;

        var dx = (e.clientX - dragStartX) / scale;
        var dy = (e.clientY - dragStartY) / scale;

        var newX = dragNodeStartX + dx;
        var newY = dragNodeStartY + dy;

        Graph.setNodePosition(dragNodeId, newX, newY);
        dragNodeEl.style.left = newX + 'px';
        dragNodeEl.style.top = newY + 'px';

        // Update connected edges
        requestAnimationFrame(function () {
            Renderer.updateEdgesForNode(dragNodeId);
            Renderer.renderColumnEdges(getTransform());
        });
    }

    function onDragEnd(e) {
        if (!isDragging) return;
        if (dragNodeEl) {
            dragNodeEl.classList.remove('is-dragging');
        }
        Renderer.updateGroups();
        isDragging = false;
        dragNodeId = null;
        dragNodeEl = null;
    }

    // ---- Expand / Collapse ----

    function onNodeClick(e) {
        // Expand/collapse button
        var expandBtn = e.target.closest('[data-action="toggle-expand"]');
        if (expandBtn) {
            var nodeId = expandBtn.getAttribute('data-node-id');
            toggleNodeExpansion(nodeId);
            e.stopPropagation();
            return;
        }

        // Column click → highlight column lineage
        var colEl = e.target.closest('.node__column');
        if (colEl) {
            var colName = colEl.getAttribute('data-column');
            var colNodeId = colEl.getAttribute('data-node-id');
            if (highlightedColumn && highlightedColumn.nodeId === colNodeId && highlightedColumn.columnName === colName) {
                Renderer.clearHighlights();
                highlightedColumn = null;
            } else {
                Renderer.highlightColumn(colNodeId, colName);
                highlightedColumn = { nodeId: colNodeId, columnName: colName };
            }
            e.stopPropagation();
            return;
        }

        // Node click → highlight connected edges
        var nodeEl = e.target.closest('.node');
        if (nodeEl) {
            var nid = nodeEl.getAttribute('data-node-id');
            Renderer.highlightNode(nid);
            highlightedColumn = null;
            e.stopPropagation();
        }
    }

    function toggleNodeExpansion(nodeId) {
        var wasExpanded = Graph.isExpanded(nodeId);
        Graph.toggleExpanded(nodeId);

        var nodeEl = document.querySelector('[data-node-id="' + nodeId + '"]');
        if (!nodeEl) return;

        if (wasExpanded) {
            nodeEl.classList.remove('node--expanded');
        } else {
            nodeEl.classList.add('node--expanded');
        }

        // After the CSS transition, update edges and groups
        setTimeout(function () {
            Renderer.updateNodeRectFromDOM(nodeId);
            Renderer.updateEdgesForNode(nodeId);
            Renderer.renderColumnEdges(getTransform());
            Renderer.updateGroups();
        }, 280); // match CSS transition duration
    }

    function onExpandAll() {
        Graph.expandAll();
        var state = Graph.getState();
        state.nodes.forEach(function (n) {
            if (n.type === 'table') {
                var el = document.querySelector('[data-node-id="' + n.id + '"]');
                if (el) el.classList.add('node--expanded');
            }
        });
        setTimeout(function () {
            Renderer.renderAllEdges();
            Renderer.renderColumnEdges(getTransform());
            Renderer.updateGroups();
        }, 300);
    }

    function onCollapseAll() {
        Graph.collapseAll();
        var allNodes = document.querySelectorAll('.node--expanded');
        allNodes.forEach(function (el) {
            el.classList.remove('node--expanded');
        });
        setTimeout(function () {
            Renderer.renderAllEdges();
            Renderer.renderColumnEdges(getTransform());
            Renderer.updateGroups();
        }, 300);
    }

    function onContainerClick(e) {
        // If clicking directly on container background, clear highlights
        if (e.target === container || e.target.tagName === 'svg') {
            Renderer.clearHighlights();
            highlightedColumn = null;
        }
    }

    // ---- Util ----

    function clamp(val, min, max) {
        return Math.max(min, Math.min(max, val));
    }

    return {
        init: init,
        fitToScreen: fitToScreen,
        getTransform: getTransform
    };
})();
