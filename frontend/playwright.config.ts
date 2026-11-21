import { defineConfig } from '@playwright/test';

/** Uses a separate backend with an in-memory database, never the development data. */
export default defineConfig({
  testDir: './e2e',
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  use: {
    baseURL: 'http://127.0.0.1:4201',
    channel: 'chrome',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: `${process.platform === 'win32' ? 'mvnw.cmd' : './mvnw'} -B -ntp spring-boot:run "-Dspring-boot.run.arguments=--server.port=18080 --spring.datasource.url=jdbc:h2:mem:menu-e2e --spring.jpa.hibernate.ddl-auto=create-drop"`,
      cwd: '../backend',
      url: 'http://127.0.0.1:18080/api/menus',
      timeout: 120_000,
    },
    {
      command: `"${process.execPath}" node_modules/@angular/cli/bin/ng.js serve --host 127.0.0.1 --port 4201 --proxy-config e2e/proxy.conf.json`,
      url: 'http://127.0.0.1:4201',
      timeout: 120_000,
    },
  ],
});
