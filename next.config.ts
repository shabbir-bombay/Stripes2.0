import type { NextConfig } from "next";

// "standalone" bundles the server with only the files it needs, which keeps the Docker image small.
const config: NextConfig = { output: "standalone" };

export default config;
