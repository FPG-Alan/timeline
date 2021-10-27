import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// @ts-ignore
const path = require("path");

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  build: {
    lib: {
      // @ts-ignore
      entry: path.resolve(__dirname, "lib/main.tsx"),
      name: "timeline",
      fileName: (format) => `timeline.${format}.js`,
    },
    rollupOptions: {
      // make sure to externalize deps that shouldn't be bundled
      // into your library
      external: ["react"],
      output: {
        // Provide global variables to use in the UMD build
        // for externalized deps
        globals: {
          react: "React",
        },
      },
    },
  },
});
