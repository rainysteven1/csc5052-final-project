import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
var __dirname = path.dirname(fileURLToPath(import.meta.url));
var pollingEnabled = (process.env.VITE_USE_POLLING || "true").toLowerCase() !== "false";
var pollingInterval = Number.parseInt(process.env.VITE_POLLING_INTERVAL || "1000", 10);
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    server: {
        watch: {
            // Default to polling so local dev does not crash on machines with low inotify limits.
            usePolling: pollingEnabled,
            interval: Number.isFinite(pollingInterval) ? pollingInterval : 1000,
            ignored: [
                "**/.git/**",
                "**/dist/**",
                "**/coverage/**",
                "**/.cache/**",
            ],
        },
        proxy: {
            "/api": {
                target: process.env.VITE_API_PROXY_TARGET || "http://127.0.0.1:8000",
                changeOrigin: true,
            },
        },
    },
});
