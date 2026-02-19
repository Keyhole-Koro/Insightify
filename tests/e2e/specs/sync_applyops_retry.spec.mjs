import { test, expect } from '@playwright/test';
import { buildChatNode, installBaseRpcMocks, installMockInteractionSocket } from '../helpers/mockBackend.mjs';

test('sync retries apply ops and converges after transient failures', async ({ page }) => {
  await installMockInteractionSocket(page);

  let applyOpsCalls = 0;
  await installBaseRpcMocks(page, {
    restoreResponse: {
      reason: 'UI_RESTORE_REASON_RESOLVED',
      projectId: 'project-e2e-1',
      tabId: 'tab-e2e-1',
      runId: 'run-sync-1',
      document: {
        runId: 'run-sync-1',
        version: 1,
        nodes: [
          buildChatNode({
            nodeId: 'node-sync-1',
            messages: [{ id: 'a1', role: 'ROLE_ASSISTANT', content: 'hello' }],
          }),
        ],
      },
      documentHash: 'hash-sync-1',
    },
    applyOpsHandler: (route) => {
      applyOpsCalls += 1;
      if (applyOpsCalls <= 2) {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'temporary failure' }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          conflict: false,
          currentVersion: 2,
          document: {
            runId: 'run-sync-1',
            version: 2,
            nodes: [],
          },
        }),
      });
    },
  });

  await page.goto('/');
  await expect(page.getByText(/Restore succeeded \(server\)/)).toBeVisible();

  const textarea = page.getByPlaceholder('Type a message...').first();
  await textarea.fill('retry me');
  await textarea.press('Enter');

  await expect
    .poll(() => applyOpsCalls, { timeout: 15_000 })
    .toBeGreaterThanOrEqual(3);
  await expect(page.getByText('mock assistant reply')).toBeVisible();
});
