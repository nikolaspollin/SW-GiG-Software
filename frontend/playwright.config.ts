import { defineConfig } from '@playwright/test';

/** Runs browser checks against isolated local demo servers. */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4200', channel: 'chrome', trace: 'retain-on-failure' },
  webServer: [
    {
      command: `${process.platform === 'win32' ? 'mvnw.cmd' : './mvnw'} -B -ntp ${process.env['GIG_MAVEN_ARGS'] ?? ''} spring-boot:run -Dspring-boot.run.profiles=cart-demo`,
      cwd: '../backend',
      url: 'http://127.0.0.1:8080/api/order-drafts/current',
      env: { GIG_DATABASE_URL: 'jdbc:h2:mem:cart-browser', SERVER_ADDRESS: '127.0.0.1' },
      timeout: 120_000,
    },
    {
      command: `"${process.execPath}" node_modules/@angular/cli/bin/ng.js serve --host 127.0.0.1`,
      url: 'http://127.0.0.1:4200',
      timeout: 120_000,
    },
  ],
});
