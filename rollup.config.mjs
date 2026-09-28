import commonjs from "@rollup/plugin-commonjs";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";

const plugin = {
  input: "src/plugin.ts",
  output: {
    file: "com.esheep.switchbot.sdPlugin/bin/plugin.js",
    format: "esm",
    sourcemap: false
  },
  plugins: [
    nodeResolve({ preferBuiltins: true }),
    commonjs(),
    typescript({ tsconfig: "./tsconfig.plugin.json" })
  ]
};

const propertyInspectors = [
  ["src/property-inspector/api-request/index.ts", "com.esheep.switchbot.sdPlugin/ui/api-request.js"],
  ["src/property-inspector/get-status/index.ts", "com.esheep.switchbot.sdPlugin/ui/get-status.js"],
  ["src/property-inspector/infrared-remote/index.ts", "com.esheep.switchbot.sdPlugin/ui/infrared-remote.js"],
  ["src/property-inspector/bot-control/index.ts", "com.esheep.switchbot.sdPlugin/ui/bot-control.js"]
].map(([input, file]) => ({
  input,
  output: {
    file,
    format: "iife",
    sourcemap: true
  },
  plugins: [
    nodeResolve({ browser: true }),
    typescript({ tsconfig: "./tsconfig.pi.json" })
  ]
}));

export default [plugin, ...propertyInspectors];
