import { defineConfig } from '@open-form-build/core';

export default defineConfig({
  // Built-in buttons and messages: 'en' (default) | 'zh-TW' | 'zh-CN' | 'ja'.
  // locale: 'zh-TW',
  // Forms open and close (`opensAt` / `closesAt`) by the clock in this time zone.
  timeZone: 'UTC',
  // protection: { rateLimit: { max: 10, window: '10m' } },
});
