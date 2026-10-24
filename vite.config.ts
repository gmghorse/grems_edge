import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import process from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const host = process.env.TAURI_DEV_HOST;

export default defineConfig(() => ({
    plugins: [react(), tailwindcss()],

    // Keep Tauri errors visible in the terminal.
    clearScreen: false,

    // Tauri expects this fixed port during development.
    server: {
        port: 1420,
        strictPort: true,
        host: host || false,
        hmr: host
            ? {
                protocol: "ws",
                host,
                port: 1421,
            }
            : undefined,
        watch: {
            ignored: ["**/src-tauri/**"],
        },
    },

    resolve: {
        alias: {
            "@": path.resolve(__dirname, "src"),
        },
    },
}));