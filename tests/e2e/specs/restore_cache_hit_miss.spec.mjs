import { test, expect } from '@playwright/test';
import { buildChatNode, installBaseRpcMocks, installMockInteractionSocket, seedRestoreCache } from '../helpers/mockBackend.mjs';

const runId = 'run-cache-1';
const tabId = 'tab-e2e-1';
const projectId = 'project-e2e-1';
const UI_RESTORE_REASON_RESOLVED = 1;
const ROLE_ASSISTANT = 2;

test.describe('restore cache source selection', () => {
  test('uses server document even when local meta matches', async ({ page }) => {
    await seedRestoreCache(page, {
      projectId,
      tabId,
      runId,
      documentHash: 'hash-cache-1',
    });

    await installMockInteractionSocket(page);
    await installBaseRpcMocks(page, {
      restoreResponse: {
        reason: UI_RESTORE_REASON_RESOLVED,
        projectId,
        tabId,
        runId,
        document: {
          runId,
          version: 1,
          nodes: [
            buildChatNode({
              nodeId: 'node-server-doc',
              messages: [
                { id: 's1', role: ROLE_ASSISTANT, content: 'server document' },
              ],
            }),
          ],
        },
        documentHash: 'hash-cache-1',
      },
    });

    await page.goto('/');
    await expect(page.getByText(/Restore succeeded \(server\)/)).toBeVisible();
    await expect(page.getByText('server document')).toBeVisible();
  });

  test('uses server when local meta hash mismatches', async ({ page }) => {
    await seedRestoreCache(page, {
      projectId,
      tabId,
      runId,
      documentHash: 'hash-old',
    });

    await installMockInteractionSocket(page);
    await installBaseRpcMocks(page, {
      restoreResponse: {
        reason: UI_RESTORE_REASON_RESOLVED,
        projectId,
        tabId,
        runId,
        document: {
          runId,
          version: 3,
          nodes: [
            buildChatNode({
              nodeId: 'node-server-win',
              messages: [
                { id: 's2', role: ROLE_ASSISTANT, content: 'fresh server document' },
              ],
            }),
          ],
        },
        documentHash: 'hash-new',
      },
    });

    await page.goto('/');
    await expect(page.getByText(/Restore succeeded \(server\)/)).toBeVisible();
    await expect(page.getByText('fresh server document')).toBeVisible();
  });
});
