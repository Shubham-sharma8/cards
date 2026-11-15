import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

export default defineCloudflareConfig({
  // Serve pre-rendered static pages directly from Workers Static Assets and intercept before NextNodeServer ResponseCache
  incrementalCache: staticAssetsIncrementalCache,
  enableCacheInterception: true,
});
