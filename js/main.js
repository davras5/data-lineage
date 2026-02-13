/**
 * Main — Entry point. Loads data, initializes graph, renders, wires interactions.
 */
window.LineageApp = window.LineageApp || {};

(function () {

    var Graph = window.LineageApp.Graph;
    var Renderer = window.LineageApp.Renderer;
    var Interactions = window.LineageApp.Interactions;

    // Fallback sample data in case fetch fails (e.g. file:// protocol)
    var FALLBACK_DATA = {
        nodes: [
            { id: "raw_orders", type: "table", label: "raw_orders", database: "ecommerce_db", schema: "shopify", columns: [
                { name: "order_id", dataType: "INT", tags: ["PK"] },
                { name: "customer_id", dataType: "INT", tags: ["FK"] },
                { name: "product_id", dataType: "INT", tags: ["FK"] },
                { name: "order_date", dataType: "TIMESTAMP" },
                { name: "quantity", dataType: "INT" },
                { name: "total_amount", dataType: "DECIMAL" },
                { name: "status", dataType: "VARCHAR" },
                { name: "shipping_address", dataType: "VARCHAR" },
                { name: "shipping_date", dataType: "DATE" }
            ]},
            { id: "raw_customers", type: "table", label: "raw_customers", database: "ecommerce_db", schema: "shopify", columns: [
                { name: "customer_id", dataType: "INT", tags: ["PK"] },
                { name: "first_name", dataType: "VARCHAR" },
                { name: "last_name", dataType: "VARCHAR" },
                { name: "email", dataType: "VARCHAR" },
                { name: "membership", dataType: "VARCHAR" },
                { name: "created_at", dataType: "TIMESTAMP" }
            ]},
            { id: "raw_products", type: "table", label: "raw_products", database: "ecommerce_db", schema: "shopify", columns: [
                { name: "product_id", dataType: "INT", tags: ["PK"] },
                { name: "product_name", dataType: "VARCHAR" },
                { name: "category", dataType: "VARCHAR" },
                { name: "vendor", dataType: "VARCHAR" },
                { name: "price", dataType: "DECIMAL" }
            ]},
            { id: "etl_order_enrichment", type: "pipeline", label: "order_enrichment_etl", description: "Joins orders with customer and product data, computes derived fields", platform: "Airflow" },
            { id: "fact_orders", type: "table", label: "fact_orders", database: "ecommerce_dw", schema: "analytics", columns: [
                { name: "order_key", dataType: "INT", tags: ["PK"] },
                { name: "order_id", dataType: "INT" },
                { name: "customer_key", dataType: "INT", tags: ["FK"] },
                { name: "product_name", dataType: "VARCHAR" },
                { name: "category", dataType: "VARCHAR" },
                { name: "order_date", dataType: "DATE" },
                { name: "quantity", dataType: "INT" },
                { name: "total_amount", dataType: "DECIMAL" },
                { name: "status", dataType: "VARCHAR" }
            ]},
            { id: "dim_customer", type: "table", label: "dim_customer", database: "ecommerce_dw", schema: "analytics", columns: [
                { name: "customer_key", dataType: "INT", tags: ["PK"] },
                { name: "customer_id", dataType: "INT" },
                { name: "full_name", dataType: "VARCHAR" },
                { name: "email", dataType: "VARCHAR" },
                { name: "membership", dataType: "VARCHAR" }
            ]},
            { id: "dashboard_sales", type: "dashboard", label: "Sales Overview Dashboard", platform: "Looker", charts: ["Revenue by Month", "Top Customers", "Order Status", "Category Breakdown"] }
        ],
        edges: [
            { id: "e1", source: "raw_orders", target: "etl_order_enrichment", columnMapping: [] },
            { id: "e2", source: "raw_customers", target: "etl_order_enrichment", columnMapping: [] },
            { id: "e3", source: "raw_products", target: "etl_order_enrichment", columnMapping: [] },
            { id: "e4", source: "etl_order_enrichment", target: "fact_orders", columnMapping: [
                { sourceNode: "raw_orders", sourceColumn: "order_id", targetColumn: "order_id" },
                { sourceNode: "raw_orders", sourceColumn: "order_date", targetColumn: "order_date" },
                { sourceNode: "raw_orders", sourceColumn: "quantity", targetColumn: "quantity" },
                { sourceNode: "raw_orders", sourceColumn: "total_amount", targetColumn: "total_amount" },
                { sourceNode: "raw_orders", sourceColumn: "status", targetColumn: "status" },
                { sourceNode: "raw_products", sourceColumn: "product_name", targetColumn: "product_name" },
                { sourceNode: "raw_products", sourceColumn: "category", targetColumn: "category" },
                { sourceNode: "raw_orders", sourceColumn: "customer_id", targetColumn: "customer_key" }
            ]},
            { id: "e5", source: "etl_order_enrichment", target: "dim_customer", columnMapping: [
                { sourceNode: "raw_customers", sourceColumn: "customer_id", targetColumn: "customer_id" },
                { sourceNode: "raw_customers", sourceColumn: "first_name", targetColumn: "full_name" },
                { sourceNode: "raw_customers", sourceColumn: "last_name", targetColumn: "full_name" },
                { sourceNode: "raw_customers", sourceColumn: "email", targetColumn: "email" },
                { sourceNode: "raw_customers", sourceColumn: "membership", targetColumn: "membership" }
            ]},
            { id: "e6", source: "fact_orders", target: "dashboard_sales", columnMapping: [] },
            { id: "e7", source: "dim_customer", target: "dashboard_sales", columnMapping: [] }
        ]
    };

    async function init() {
        var data;

        try {
            var response = await fetch('data/lineage.json');
            data = await response.json();
        } catch (err) {
            console.warn('Could not fetch lineage.json, using fallback data:', err.message);
            data = FALLBACK_DATA;
        }

        // Initialize graph model and compute layout
        Graph.init(data);

        // Initialize renderer and draw everything
        Renderer.init();
        Renderer.renderAllNodes();
        Renderer.renderAllEdges();

        // Initialize interactions (pan, zoom, drag, etc.)
        Interactions.init();

        // Fit the graph to screen after a frame so DOM measurements are accurate
        requestAnimationFrame(function () {
            Interactions.fitToScreen();
        });
    }

    // Start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
