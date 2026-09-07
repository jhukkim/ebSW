import path from "node:path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { viteSingleFile } from "vite-plugin-singlefile"

// `--mode single` 은 아티팩트/공유용 단일 HTML 을 dist-single/ 에 만든다.
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), ...(mode === "single" ? [viteSingleFile()] : [])],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  build: mode === "single" ? { outDir: "dist-single" } : {},
}))
