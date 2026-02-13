/**
 * Renderer — Creates DOM nodes and SVG edges for the lineage graph.
 */
window.LineageApp = window.LineageApp || {};

window.LineageApp.Renderer = (function () {

    var Graph = window.LineageApp.Graph;
    var EdgeRouting = window.LineageApp.EdgeRouting;

    var nodeLayer = null;
    var edgeLayer = null;

    // SVG icons as inline strings
    var ICONS = {
        table: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
            '<rect x="1" y="1" width="14" height="14" rx="2"/>' +
            '<line x1="1" y1="5.5" x2="15" y2="5.5"/>' +
            '<line x1="5.5" y1="5.5" x2="5.5" y2="15"/>' +
            '</svg>',
        pipeline: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
            '<circle cx="8" cy="8" r="6"/>' +
            '<path d="M8 4v4l3 2"/>' +
            '</svg>',
        dashboard: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
            '<rect x="1" y="1" width="14" height="14" rx="2"/>' +
            '<line x1="4" y1="11" x2="4" y2="7"/>' +
            '<line x1="8" y1="11" x2="8" y2="4"/>' +
            '<line x1="12" y1="11" x2="12" y2="9"/>' +
            '</svg>'
    };

    var EXPAND_ARROW = '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 4 5 7 8 4"/></svg>';

    function init() {
        nodeLayer = document.getElementById('node-layer');
        edgeLayer = document.getElementById('edge-layer');
    }

    // ---- Node Rendering ----

    function renderAllNodes() {
        nodeLayer.innerHTML = '';
        renderGroups();
        var state = Graph.getState();
        state.nodes.forEach(function (node) {
            var el = createNodeElement(node);
            nodeLayer.appendChild(el);
        });
    }

    /**
     * Derive system groups from existing node properties and render bounding boxes.
     * Tables group by "database.schema", pipelines/dashboards group by "platform".
     */
    function renderGroups() {
        var state = Graph.getState();
        var groups = {};

        state.nodes.forEach(function (node) {
            var groupKey;
            if (node.type === 'table' && node.database) {
                groupKey = node.database + (node.schema ? '.' + node.schema : '');
            } else if (node.platform) {
                groupKey = node.platform;
            }
            if (!groupKey) return;

            if (!groups[groupKey]) {
                groups[groupKey] = { label: groupKey, nodeIds: [] };
            }
            groups[groupKey].nodeIds.push(node.id);
        });

        var GROUP_PAD = 20;
        var LABEL_HEIGHT = 24;

        Object.keys(groups).forEach(function (key) {
            var group = groups[key];
            if (group.nodeIds.length < 1) return;

            // Compute bounding box of all nodes in this group
            var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            group.nodeIds.forEach(function (id) {
                var r = Graph.getNodeRect(id);
                if (!r) return;
                // Also check actual DOM height for expanded nodes
                var el = document.querySelector('[data-node-id="' + id + '"]');
                var h = el ? el.offsetHeight : r.height;
                minX = Math.min(minX, r.x);
                minY = Math.min(minY, r.y);
                maxX = Math.max(maxX, r.x + r.width);
                maxY = Math.max(maxY, r.y + h);
            });

            if (minX === Infinity) return;

            var groupEl = document.createElement('div');
            groupEl.className = 'group-box';
            groupEl.setAttribute('data-group', key);
            groupEl.style.left = (minX - GROUP_PAD) + 'px';
            groupEl.style.top = (minY - GROUP_PAD - LABEL_HEIGHT) + 'px';
            groupEl.style.width = (maxX - minX + GROUP_PAD * 2) + 'px';
            groupEl.style.height = (maxY - minY + GROUP_PAD * 2 + LABEL_HEIGHT) + 'px';

            var labelEl = document.createElement('span');
            labelEl.className = 'group-box__label';
            labelEl.textContent = group.label;
            groupEl.appendChild(labelEl);

            nodeLayer.appendChild(groupEl);
        });
    }

    function createNodeElement(node) {
        var pos = Graph.getNodeRect(node.id);
        var el = document.createElement('div');
        el.className = 'node node--' + node.type;
        el.setAttribute('data-node-id', node.id);
        el.style.left = pos.x + 'px';
        el.style.top = pos.y + 'px';
        el.style.width = pos.width + 'px';

        if (Graph.isExpanded(node.id)) {
            el.classList.add('node--expanded');
        }

        // Header
        var header = document.createElement('div');
        header.className = 'node__header';

        var icon = document.createElement('span');
        icon.className = 'node__icon';
        icon.style.color = node.type === 'pipeline' ? 'var(--color-pipeline)' :
                           node.type === 'dashboard' ? 'var(--color-dashboard)' :
                           'var(--color-primary)';
        icon.innerHTML = ICONS[node.type] || ICONS.table;
        header.appendChild(icon);

        var label = document.createElement('span');
        label.className = 'node__label';
        label.textContent = node.label;
        header.appendChild(label);

        if (node.type === 'table' && node.columns) {
            var badge = document.createElement('span');
            badge.className = 'node__badge';
            badge.textContent = node.columns.length + ' cols';
            header.appendChild(badge);

            var expandBtn = document.createElement('button');
            expandBtn.className = 'node__expand-btn';
            expandBtn.innerHTML = EXPAND_ARROW;
            expandBtn.setAttribute('data-action', 'toggle-expand');
            expandBtn.setAttribute('data-node-id', node.id);
            header.appendChild(expandBtn);
        }

        el.appendChild(header);

        // Subtitle
        if (node.type === 'table') {
            var subtitle = document.createElement('div');
            subtitle.className = 'node__subtitle';
            subtitle.textContent = node.database + '.' + node.schema;
            el.appendChild(subtitle);
        } else if (node.type === 'pipeline') {
            var subtitle2 = document.createElement('div');
            subtitle2.className = 'node__subtitle';
            subtitle2.textContent = node.platform || '';
            el.appendChild(subtitle2);

            if (node.description) {
                var desc = document.createElement('div');
                desc.className = 'node__description';
                desc.textContent = node.description;
                el.appendChild(desc);
            }
        } else if (node.type === 'dashboard') {
            var subtitle3 = document.createElement('div');
            subtitle3.className = 'node__subtitle';
            subtitle3.textContent = node.platform || '';
            el.appendChild(subtitle3);

            if (node.charts && node.charts.length > 0) {
                var chartsDiv = document.createElement('div');
                chartsDiv.className = 'node__charts';
                node.charts.forEach(function (chart) {
                    var pill = document.createElement('span');
                    pill.className = 'node__chart-pill';
                    pill.textContent = chart;
                    chartsDiv.appendChild(pill);
                });
                el.appendChild(chartsDiv);
            }
        }

        // Columns (for table nodes)
        if (node.type === 'table' && node.columns) {
            var columnsDiv = document.createElement('div');
            columnsDiv.className = 'node__columns';

            node.columns.forEach(function (col) {
                var colRow = document.createElement('div');
                colRow.className = 'node__column';
                colRow.setAttribute('data-column', col.name);
                colRow.setAttribute('data-node-id', node.id);

                var portLeft = document.createElement('span');
                portLeft.className = 'node__column-port node__column-port--left';
                colRow.appendChild(portLeft);

                var colName = document.createElement('span');
                colName.className = 'node__column-name';
                colName.textContent = col.name;
                colRow.appendChild(colName);

                var colType = document.createElement('span');
                colType.className = 'node__column-type';
                colType.textContent = col.dataType;
                colRow.appendChild(colType);

                if (col.tags) {
                    col.tags.forEach(function (tag) {
                        var tagEl = document.createElement('span');
                        tagEl.className = 'node__column-tag node__column-tag--' + tag.toLowerCase();
                        tagEl.textContent = tag;
                        colRow.appendChild(tagEl);
                    });
                }

                var portRight = document.createElement('span');
                portRight.className = 'node__column-port node__column-port--right';
                colRow.appendChild(portRight);

                columnsDiv.appendChild(colRow);
            });

            el.appendChild(columnsDiv);
        }

        return el;
    }

    // ---- Edge Rendering ----

    function renderAllEdges() {
        // Remove old edge paths (keep defs)
        var oldPaths = edgeLayer.querySelectorAll('.edge');
        oldPaths.forEach(function (p) { p.remove(); });

        var state = Graph.getState();
        state.edges.forEach(function (edge) {
            renderEdge(edge);
        });
    }

    function renderEdge(edge) {
        var srcRect = Graph.getNodeRect(edge.source);
        var tgtRect = Graph.getNodeRect(edge.target);
        if (!srcRect || !tgtRect) return;

        // Recompute height from actual DOM if expanded
        updateNodeRectFromDOM(edge.source);
        updateNodeRectFromDOM(edge.target);
        srcRect = Graph.getNodeRect(edge.source);
        tgtRect = Graph.getNodeRect(edge.target);

        var d = EdgeRouting.computeEdgePath(srcRect, tgtRect);

        var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        path.setAttribute('class', 'edge');
        path.setAttribute('data-edge-id', edge.id);
        path.setAttribute('data-source', edge.source);
        path.setAttribute('data-target', edge.target);

        edgeLayer.appendChild(path);
    }

    function updateNodeRectFromDOM(nodeId) {
        var el = document.querySelector('[data-node-id="' + nodeId + '"]');
        if (!el) return;
        var pos = Graph.getNodeRect(nodeId);
        if (!pos) return;
        Graph.setNodeHeight(nodeId, el.offsetHeight);
    }

    /**
     * Re-render edges connected to a specific node (after drag or expand).
     */
    function updateEdgesForNode(nodeId) {
        var state = Graph.getState();
        state.edges.forEach(function (edge) {
            if (edge.source === nodeId || edge.target === nodeId) {
                var oldPath = edgeLayer.querySelector('[data-edge-id="' + edge.id + '"]');
                if (oldPath) oldPath.remove();
                renderEdge(edge);
            }
        });
    }

    /**
     * Render column-level lineage edges for expanded nodes.
     * Call this after nodes have been rendered and expanded.
     */
    function renderColumnEdges(transform) {
        // Remove old column edges
        var oldColumnEdges = edgeLayer.querySelectorAll('.edge--column');
        oldColumnEdges.forEach(function (p) { p.remove(); });

        var state = Graph.getState();

        state.edges.forEach(function (edge) {
            if (!edge.columnMapping || edge.columnMapping.length === 0) return;

            var targetNode = state.nodeMap[edge.target];
            if (!targetNode || targetNode.type !== 'table') return;
            if (!Graph.isExpanded(edge.target)) return;

            edge.columnMapping.forEach(function (cm) {
                var sourceExpanded = Graph.isExpanded(cm.sourceNode);
                var targetExpanded = Graph.isExpanded(edge.target);

                if (!targetExpanded) return;

                var fromPos, toPos;

                if (sourceExpanded) {
                    fromPos = EdgeRouting.getColumnPortPosition(cm.sourceNode, cm.sourceColumn, 'right', transform);
                } else {
                    // Use the right center of the source node
                    var srcRect = Graph.getNodeRect(cm.sourceNode);
                    if (srcRect) {
                        fromPos = EdgeRouting.getNodeEdgeCenter(srcRect, 'right');
                    }
                }

                toPos = EdgeRouting.getColumnPortPosition(edge.target, cm.targetColumn, 'left', transform);

                if (!fromPos || !toPos) return;

                var d = EdgeRouting.computeColumnEdgePath(fromPos, toPos);

                var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('d', d);
                path.setAttribute('class', 'edge edge--column');
                path.setAttribute('data-source-node', cm.sourceNode);
                path.setAttribute('data-source-column', cm.sourceColumn);
                path.setAttribute('data-target-node', edge.target);
                path.setAttribute('data-target-column', cm.targetColumn);

                edgeLayer.appendChild(path);
            });
        });
    }

    // ---- Highlighting ----

    function highlightNode(nodeId) {
        // Dim all nodes and edges, then highlight the selected one and its connections
        var allNodes = nodeLayer.querySelectorAll('.node');
        var allEdges = edgeLayer.querySelectorAll('.edge');

        var connectedNodeIds = new Set();
        connectedNodeIds.add(nodeId);

        var connectedEdgeIds = new Set();
        var state = Graph.getState();
        state.edges.forEach(function (edge) {
            if (edge.source === nodeId || edge.target === nodeId) {
                connectedEdgeIds.add(edge.id);
                connectedNodeIds.add(edge.source);
                connectedNodeIds.add(edge.target);
            }
        });

        allNodes.forEach(function (n) {
            var nid = n.getAttribute('data-node-id');
            if (connectedNodeIds.has(nid)) {
                n.classList.add('is-highlighted');
                n.classList.remove('is-dimmed');
            } else {
                n.classList.add('is-dimmed');
                n.classList.remove('is-highlighted');
            }
        });

        allEdges.forEach(function (e) {
            var eid = e.getAttribute('data-edge-id');
            var srcNode = e.getAttribute('data-source-node');
            var tgtNode = e.getAttribute('data-target-node');
            var isTableEdge = eid !== null;
            var isColumnEdge = srcNode !== null;

            if (isTableEdge && connectedEdgeIds.has(eid)) {
                e.classList.add('edge--highlighted');
                e.classList.remove('edge--dimmed');
            } else if (isColumnEdge && (connectedNodeIds.has(srcNode) || connectedNodeIds.has(tgtNode))) {
                e.classList.add('edge--highlighted');
                e.classList.remove('edge--dimmed');
            } else {
                e.classList.add('edge--dimmed');
                e.classList.remove('edge--highlighted');
            }
        });
    }

    function highlightColumn(nodeId, columnName) {
        var allEdges = edgeLayer.querySelectorAll('.edge');

        // Find all column edges involving this column
        var connectedColumns = new Set();
        connectedColumns.add(nodeId + ':' + columnName);

        // Check forward lineage
        var forwardLineage = Graph.getColumnLineage(nodeId, columnName);
        forwardLineage.forEach(function (cl) {
            connectedColumns.add(cl.targetNode + ':' + cl.targetColumn);
        });

        // Check reverse lineage
        var reverseLineage = Graph.getColumnLineageReverse(nodeId, columnName);
        reverseLineage.forEach(function (cl) {
            connectedColumns.add(cl.sourceNode + ':' + cl.sourceColumn);
        });

        // Highlight matching column rows
        var allColumns = nodeLayer.querySelectorAll('.node__column');
        allColumns.forEach(function (colEl) {
            var cName = colEl.getAttribute('data-column');
            var nId = colEl.getAttribute('data-node-id');
            var key = nId + ':' + cName;
            if (connectedColumns.has(key)) {
                colEl.classList.add('is-highlighted');
            } else {
                colEl.classList.remove('is-highlighted');
            }
        });

        // Highlight matching column edges
        allEdges.forEach(function (e) {
            var srcNode = e.getAttribute('data-source-node');
            var srcCol = e.getAttribute('data-source-column');
            var tgtNode = e.getAttribute('data-target-node');
            var tgtCol = e.getAttribute('data-target-column');

            if (srcNode && srcCol && tgtNode && tgtCol) {
                var srcKey = srcNode + ':' + srcCol;
                var tgtKey = tgtNode + ':' + tgtCol;
                if (connectedColumns.has(srcKey) || connectedColumns.has(tgtKey)) {
                    e.classList.add('edge--highlighted');
                    e.classList.remove('edge--dimmed');
                } else {
                    e.classList.add('edge--dimmed');
                    e.classList.remove('edge--highlighted');
                }
            } else {
                // Table-level edges: dim them when showing column highlight
                e.classList.add('edge--dimmed');
                e.classList.remove('edge--highlighted');
            }
        });
    }

    function clearHighlights() {
        var allNodes = nodeLayer.querySelectorAll('.node');
        allNodes.forEach(function (n) {
            n.classList.remove('is-highlighted', 'is-dimmed');
        });

        var allEdges = edgeLayer.querySelectorAll('.edge');
        allEdges.forEach(function (e) {
            e.classList.remove('edge--highlighted', 'edge--dimmed');
        });

        var allColumns = nodeLayer.querySelectorAll('.node__column');
        allColumns.forEach(function (c) {
            c.classList.remove('is-highlighted');
        });
    }

    /**
     * Refresh just the group bounding boxes (e.g. after drag or expand).
     */
    function updateGroups() {
        var oldGroups = nodeLayer.querySelectorAll('.group-box');
        oldGroups.forEach(function (g) { g.remove(); });
        renderGroups();
    }

    return {
        init: init,
        renderAllNodes: renderAllNodes,
        renderAllEdges: renderAllEdges,
        updateEdgesForNode: updateEdgesForNode,
        renderColumnEdges: renderColumnEdges,
        updateGroups: updateGroups,
        highlightNode: highlightNode,
        highlightColumn: highlightColumn,
        clearHighlights: clearHighlights,
        updateNodeRectFromDOM: updateNodeRectFromDOM
    };
})();
