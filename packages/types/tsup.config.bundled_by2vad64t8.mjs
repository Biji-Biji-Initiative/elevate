// tsup.config.ts
import { defineConfig } from "tsup";

const tsup_config_default = defineConfig({
  entry: [
    "src/index.ts",
    "src/schemas.ts",
    "src/query-schemas.ts",
    "src/admin-schemas.ts",
    "src/api-types.ts",
    "src/ui-types.ts",
    "src/common.ts",
    "src/submission-payloads.ts",
    "src/webhooks.ts",
    "src/errors.ts",
    "src/canonical-urls.ts",
    "src/http.ts"
  ],
  format: ["esm"],
  outDir: "dist/js",
  dts: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: false,
  minify: false,
  target: "es2022",
  platform: "neutral",
  external: ["zod", /^@elevate\//]
});
export {
  tsup_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidHN1cC5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9faW5qZWN0ZWRfZmlsZW5hbWVfXyA9IFwiL1VzZXJzL2FnZW50LWcvZWxldmF0ZS9lbGV2YXRlL3BhY2thZ2VzL3R5cGVzL3RzdXAuY29uZmlnLnRzXCI7Y29uc3QgX19pbmplY3RlZF9kaXJuYW1lX18gPSBcIi9Vc2Vycy9hZ2VudC1nL2VsZXZhdGUvZWxldmF0ZS9wYWNrYWdlcy90eXBlc1wiO2NvbnN0IF9faW5qZWN0ZWRfaW1wb3J0X21ldGFfdXJsX18gPSBcImZpbGU6Ly8vVXNlcnMvYWdlbnQtZy9lbGV2YXRlL2VsZXZhdGUvcGFja2FnZXMvdHlwZXMvdHN1cC5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd0c3VwJ1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBlbnRyeTogW1xuICAgICdzcmMvaW5kZXgudHMnLFxuICAgICdzcmMvc2NoZW1hcy50cycsXG4gICAgJ3NyYy9xdWVyeS1zY2hlbWFzLnRzJyxcbiAgICAnc3JjL2FkbWluLXNjaGVtYXMudHMnLFxuICAgICdzcmMvYXBpLXR5cGVzLnRzJyxcbiAgICAnc3JjL3VpLXR5cGVzLnRzJyxcbiAgICAnc3JjL2NvbW1vbi50cycsXG4gICAgJ3NyYy9zdWJtaXNzaW9uLXBheWxvYWRzLnRzJyxcbiAgICAnc3JjL3dlYmhvb2tzLnRzJyxcbiAgICAnc3JjL2Vycm9ycy50cycsXG4gICAgJ3NyYy9jYW5vbmljYWwtdXJscy50cycsXG4gICAgJ3NyYy9odHRwLnRzJyxcbiAgXSxcbiAgZm9ybWF0OiBbJ2VzbSddLFxuICBvdXREaXI6ICdkaXN0L2pzJyxcbiAgZHRzOiBmYWxzZSxcbiAgc291cmNlbWFwOiB0cnVlLFxuICBjbGVhbjogdHJ1ZSxcbiAgdHJlZXNoYWtlOiB0cnVlLFxuICBzcGxpdHRpbmc6IGZhbHNlLFxuICBtaW5pZnk6IGZhbHNlLFxuICB0YXJnZXQ6ICdlczIwMjInLFxuICBwbGF0Zm9ybTogJ25ldXRyYWwnLFxuICBleHRlcm5hbDogWyd6b2QnLCAvXkBlbGV2YXRlXFwvL10sXG59KVxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFxUixTQUFTLG9CQUFvQjtBQUVsVCxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixPQUFPO0FBQUEsSUFDTDtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsRUFDRjtBQUFBLEVBQ0EsUUFBUSxDQUFDLEtBQUs7QUFBQSxFQUNkLFFBQVE7QUFBQSxFQUNSLEtBQUs7QUFBQSxFQUNMLFdBQVc7QUFBQSxFQUNYLE9BQU87QUFBQSxFQUNQLFdBQVc7QUFBQSxFQUNYLFdBQVc7QUFBQSxFQUNYLFFBQVE7QUFBQSxFQUNSLFFBQVE7QUFBQSxFQUNSLFVBQVU7QUFBQSxFQUNWLFVBQVUsQ0FBQyxPQUFPLGFBQWE7QUFDakMsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
