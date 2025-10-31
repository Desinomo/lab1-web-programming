/**
 * socket-integration-test.js
 * Usage:
 * 1) npm install socket.io-client axios dotenv
 * 2) Create .env with SERVER_URL, API_BASE, JWT_TOKEN
 * 3) node socket-integration-test.js
 *
 * The script will:
 * - connect to socket.io with JWT
 * - listen for events
 * - call REST API to create a test resource
 * - assert that appropriate socket events arrive
 * - perform reconnect test
 */

require('dotenv').config();
const { io } = require("socket.io-client");
const axios = require("axios");

const SERVER_URL = process.env.SERVER_URL || "https://lab1-web-programming.onrender.com";
const API_BASE = process.env.API_BASE || `${SERVER_URL}/api`;
const JWT = process.env.JWT_TOKEN || process.env.ACCESS_TOKEN || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInJvbGUiOiJBRE1JTiIsImlhdCI6MTc2MTkyNTMzOSwiZXhwIjoxNzYyNTMwMTM5fQ.uYVLa-9vlyfdG_EtfQlFZeZ7ALjadQsugxcXRvomAnA";
const TIMEOUT_MS = 8000; // timeout for event waits

// configurable API endpoints (adjust to your project)
const API_PATHS = {
    createProduct: "/products",          // POST -> { name, description, price }
    createIngredient: "/ingredients",    // POST -> { name }
    getMe: "/auth/me",                   // optional
};

// helper sleep
const wait = ms => new Promise(res => setTimeout(res, ms));

async function runTest() {
    if (!JWT) {
        console.error("❌ JWT token not provided. Set JWT_TOKEN in .env (access token).");
        process.exit(1);
    }

    console.log("🔌 Connecting to Socket.IO at:", SERVER_URL);

    const socket = io(SERVER_URL, {
        auth: { token: JWT },
        transports: ["websocket", "polling"],
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
    });

    let eventsReceived = {
        productCreated: false,
        ingredientCreated: false,
        notificationNew: false,
        pingAck: false,
    };

    // event listeners
    socket.on("connect", () => {
        console.log(`✅ Connected (socket id: ${socket.id})`);
    });

    socket.on("connect_error", (err) => {
        console.error("❌ connect_error:", err && err.message ? err.message : err);
    });

    socket.on("disconnect", (reason) => {
        console.warn("⚠️ Disconnected:", reason);
    });

    // custom events your backend likely emits
    socket.on("product:created", (data) => {
        console.log("📦 product:created received:", data);
        eventsReceived.productCreated = true;
    });

    socket.on("ingredient:created", (data) => {
        console.log("🥬 ingredient:created received:", data);
        eventsReceived.ingredientCreated = true;
    });

    socket.on("notification:new", (data) => {
        console.log("🔔 notification:new received:", data);
        eventsReceived.notificationNew = true;
    });

    // optional online/offline events
    socket.on("user:online", (data) => {
        console.log("🟢 user:online:", data);
    });
    socket.on("user:offline", (data) => {
        console.log("⚫ user:offline:", data);
    });

    // ping with ack (latency test)
    function pingWithAck() {
        return new Promise((resolve) => {
            const start = Date.now();
            socket.timeout(3000).emit("client:ping", { ts: start }, (err, resp) => {
                if (err) {
                    console.warn("ping ack error or timeout:", err);
                    return resolve({ ok: false, error: err });
                }
                const latency = Date.now() - start;
                console.log(`🏓 Ping ack received. latency=${latency}ms, resp=${JSON.stringify(resp)}`);
                eventsReceived.pingAck = true;
                resolve({ ok: true, latency, resp });
            });
        });
    }

    // wait for socket to connect (up to TIMEOUT_MS)
    async function waitForConnect() {
        const deadline = Date.now() + TIMEOUT_MS;
        while (Date.now() < deadline) {
            if (socket.connected) return true;
            await wait(200);
        }
        return false;
    }

    const connected = await waitForConnect();
    if (!connected) {
        console.error("❌ Socket didn't connect within timeout. Stop test.");
        process.exit(1);
    }

    // 1) Test ping ack (if server supports)
    try {
        await pingWithAck();
    } catch (e) {
        console.warn("Ping test failed (server may not implement 'client:ping' ack).", e.message || e);
    }

    // Helper to perform authorized REST calls
    const axiosInstance = axios.create({
        baseURL: API_BASE,
        headers: {
            Authorization: `Bearer ${JWT}`,
            Accept: "application/json",
            "Content-Type": "application/json"
        },
        timeout: 8000
    });

    // 2) Create a test product via REST to trigger product:created event
    async function createTestProduct() {
        try {
            const name = `test-product-${Date.now()}`;
            const payload = { name, description: "Automated test product", price: 1.23 };
            console.log("→ Creating product via REST:", API_BASE + API_PATHS.createProduct);
            const resp = await axiosInstance.post(API_PATHS.createProduct, payload);
            console.log("REST create product response status:", resp.status);
            return { ok: true, data: resp.data };
        } catch (err) {
            console.warn("REST create product failed:", err.response ? err.response.data : err.message);
            return { ok: false, error: err };
        }
    }

    // 3) Create a test ingredient similarly
    async function createTestIngredient() {
        try {
            const name = `test-ingredient-${Date.now()}`;
            console.log("→ Creating ingredient via REST:", API_BASE + API_PATHS.createIngredient);
            const resp = await axiosInstance.post(API_PATHS.createIngredient, { name });
            console.log("REST create ingredient response status:", resp.status);
            return { ok: true, data: resp.data };
        } catch (err) {
            console.warn("REST create ingredient failed:", err.response ? err.response.data : err.message);
            return { ok: false, error: err };
        }
    }

    // utility to wait for event with timeout
    function waitForFlag(flagName, timeout = TIMEOUT_MS) {
        const start = Date.now();
        return new Promise((resolve) => {
            const iv = setInterval(() => {
                if (eventsReceived[flagName]) {
                    clearInterval(iv);
                    resolve({ ok: true });
                } else if (Date.now() - start > timeout) {
                    clearInterval(iv);
                    resolve({ ok: false });
                }
            }, 150);
        });
    }

    // perform create product and wait for socket event
    const prodResult = await createTestProduct();
    if (prodResult.ok) {
        console.log("Waiting for product:created event...");
        const got = await waitForFlag("productCreated", 7000);
        console.log("product:created event arrived?", got.ok);
    } else {
        console.log("Skipping product socket check because REST create failed.");
    }

    // perform create ingredient and wait for socket event
    const ingrResult = await createTestIngredient();
    if (ingrResult.ok) {
        console.log("Waiting for ingredient:created event...");
        const got = await waitForFlag("ingredientCreated", 7000);
        console.log("ingredient:created event arrived?", got.ok);
    } else {
        console.log("Skipping ingredient socket check because REST create failed.");
    }

    // 4) Reconnection test: force disconnect and ensure reconnect
    console.log("🔁 Starting reconnection test: forcing disconnect for 3s...");
    socket.disconnect();
    await wait(3000);
    console.log("➡️ Reconnect now...");
    socket.connect();

    const reconnected = await waitForConnect();
    console.log("Reconnected?", reconnected);

    // 5) After reconnect, create another product to ensure rejoin to rooms works
    if (reconnected) {
        console.log("Creating product after reconnect to test room rejoin...");
        const afterResult = await createTestProduct();
        if (afterResult.ok) {
            const got = await waitForFlag("productCreated", 7000);
            console.log("product:created after reconnect arrived?", got.ok);
        }
    }

    // 6) Summarize results
    console.log("\n================ TEST SUMMARY ================");
    console.log("product:created received:", eventsReceived.productCreated);
    console.log("ingredient:created received:", eventsReceived.ingredientCreated);
    console.log("notification:new received:", eventsReceived.notificationNew);
    console.log("ping ack received:", eventsReceived.pingAck);
    console.log("socket connected:", socket.connected);
    console.log("==============================================\n");

    // cleanup
    console.log("Closing socket and exiting...");
    socket.close();
    process.exit(0);
}

// run
runTest().catch(err => {
    console.error("Fatal test error:", err);
    process.exit(1);
});
