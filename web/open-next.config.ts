import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  // Static-first ISR & edge dynamic SSR via Cloudflare Workers + R2 data fallback
});
