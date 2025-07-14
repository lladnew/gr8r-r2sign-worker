import { build } from "esbuild";

build({
    entryPoints: ["src/index.js"],
    bundle: true,
    outfile: "dist/index.mjs",
    format: "esm",
    platform: "browser",
    target: "es2022",
    external: ["@aws-sdk/client-s3", "@aws-sdk/s3-request-presigner"],
}).catch(() => process.exit(1));
