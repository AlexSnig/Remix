import {expect, test, type Page} from '@playwright/test';

async function mockReliableDevice(page: Page) {
  await page.addInitScript(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const context = canvas.getContext('2d');
    context?.fillRect(0, 0, 640, 480);
    const stream = canvas.captureStream(10);
    Object.defineProperty(navigator, 'mediaDevices', {configurable: true, value: {
      getUserMedia: async () => stream,
      enumerateDevices: async () => [{kind: 'videoinput', deviceId: 'camera-front', label: 'Front Camera', groupId: 'test', toJSON: () => ({})}],
      addEventListener: () => {},
      removeEventListener: () => {},
    }});
    Object.defineProperty(navigator, 'wakeLock', {configurable: true, value: {
      request: async () => ({released: false, release: async () => {}, addEventListener: () => {}}),
    }});
    Object.defineProperty(navigator, 'storage', {configurable: true, value: {
      persist: async () => true,
      persisted: async () => true,
      estimate: async () => ({usage: 100, quota: 1000000}),
    }});
    HTMLMediaElement.prototype.play = async () => {};
  });
}

test('kiosk entry arms the sensor on a mobile viewport', async ({page}, testInfo) => {
  await mockReliableDevice(page);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page).toHaveTitle('Датчик музейного експонату');
  await expect(page.getByText('Датчик музейного експонату', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: /запустити датчик|start sensor/i}).click();
  await expect(page.getByRole('button', {name: /вимкнути датчик|turn off sensor/i})).toBeVisible();
  await expect(page.getByText(/ARMED|READY/)).toBeVisible({timeout: 10000});
  expect(errors).toEqual([]);
  await page.screenshot({path: `/tmp/remix-${testInfo.project.name}-armed.png`, fullPage: false});
});

test('camera permission denial is visible and never becomes armed', async ({page}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', {configurable: true, value: {
      getUserMedia: async () => { throw new DOMException('Denied by test', 'NotAllowedError'); },
      enumerateDevices: async () => [],
      addEventListener: () => {},
      removeEventListener: () => {},
    }});
    HTMLMediaElement.prototype.play = async () => {};
  });
  await page.goto('/');
  await page.getByRole('button', {name: /запустити датчик|start sensor/i}).click();
  await expect(page.getByText(/доступ.*камер|camera.*permission/i).first()).toBeVisible({timeout: 10000});
  await expect(page.getByText('ARMED')).toHaveCount(0);
});

test('installed app shell reloads while offline', async ({page, context}) => {
  await mockReliableDevice(page);
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, {timeout: 15000});
  await context.setOffline(true);
  await page.reload();
  await expect(page).toHaveTitle('Датчик музейного експонату');
  await expect(page.getByText('Датчик музейного експонату', {exact: true})).toBeVisible();
});
