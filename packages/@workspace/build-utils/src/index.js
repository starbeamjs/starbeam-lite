import { listExports } from "@bgotink/list-exports";
import dts from "vite-plugin-dts";
import { defineConfig } from "vitest/config";

/**
 * @param {ImportMeta} meta
 * @returns
 */
export default async function (meta) {
  const maps = await listExports(new URL("./package.json", meta.url).pathname, {
    type: "import",
  });

  const entries = maps.map((m) => m.path);

  return defineConfig({
    test: {
      include: ["tests/**/*.spec.ts"],
      includeSource: ["src/**/*.ts"],
      onStackTrace: (_, { file }) => {
        if (file.includes("@workspace")) {
          return false;
        }
      },
    },

    build: {
      target: "es2022",
      minify: true,
      lib: {
        entry: entries,
        formats: ["es"],
      },
    },

    define: {
      "import.meta.vitest": "undefined",
      "import.meta.env.fishy": "false",
    },

    plugins: [dts({ rollupTypes: true })],
  });
}
