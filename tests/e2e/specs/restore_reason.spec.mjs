import { test, expect } from '@playwright/test';
import { buildChatNode, installBaseRpcMocks, installMockInteractionSocket } from '../helpers/mockBackend.mjs';
const UI_RESTORE_REASON_RESOLVED = 1;
const UI_RESTORE_REASON_NO_RUN = 3;
const ROLE_ASSISTANT = 2;

const resolvedDoc = {
  runId: 'run-restore-1',
  version: 2,
  nodes: [
    buildChatNode({
      nodeId: 'node-restore-1',
      messages: [
        { id: 'm1', role: ROLE_ASSISTANT, content: 'restored from server' },
      ],
      isResponding: false,
    }),
  ],
};

test.describe('restore reason handling', () => {
  test('RESOLVED shows restore success', async ({ page }) => {
    await installMockInteractionSocket(page);
    await installBaseRpcMocks(page, {
      restoreResponse: {
        reason: UI_RESTORE_REASON_RESOLVED,
        projectId: 'project-e2e-1',
        tabId: 'tab-e2e-1',
        runId: 'run-restore-1',
        document: resolvedDoc,
        documentHash: 'hash-resolved-1',
      },
    });

    await page.goto('/');
    await expect(page.getByText(/Restore succeeded \(server\)/)).toBeVisible();
    await expect(page.getByText('restored from server')).toBeVisible();
  });

  test('NO_RUN falls back to bootstrap init', async ({ page }) => {
    await installMockInteractionSocket(page);
    await installBaseRpcMocks(page, {
      restoreResponse: {
        reason: UI_RESTORE_REASON_NO_RUN,
        projectId: 'project-e2e-1',
        tabId: 'tab-e2e-1',
        runId: '',
        document: { runId: '', version: 0, nodes: [] },
        documentHash: '',
      },
      startRunResponse: { runId: 'run-bootstrap-1' },
    });

    await page.goto('/');
    await expect(page.getByText(/No restore target/)).toBeVisible();
  });
});
