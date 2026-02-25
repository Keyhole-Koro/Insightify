const PROJECT_ID = 'project-e2e-1';
const TAB_ID = 'tab-e2e-1';
const UI_NODE_TYPE_LLM_CHAT = 1;
const UI_RESTORE_REASON_NO_RUN = 3;

export const constants = {
  PROJECT_ID,
  TAB_ID,
};

export function buildChatNode({
  nodeId = 'llm-chat-node-1',
  title = 'LLM Chat',
  messages = [],
  isResponding = false,
} = {}) {
  return {
    id: nodeId,
    type: UI_NODE_TYPE_LLM_CHAT,
    meta: { title },
    llmChat: {
      model: 'Low',
      isResponding,
      sendLocked: false,
      sendLockHint: '',
      messages,
    },
  };
}

export async function installMockInteractionSocket(page) {
  await page.addInitScript(() => {
    class MockWS {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;

      constructor(url) {
        this.url = url;
        this.readyState = MockWS.CONNECTING;
        this.onopen = null;
        this.onmessage = null;
        this.onerror = null;
        this.onclose = null;
        setTimeout(() => {
          this.readyState = MockWS.OPEN;
          if (this.onopen) this.onopen(new Event('open'));
          this.#emit({
            type: 'wait_state',
            waiting: true,
            interactionId: 'interaction-e2e-1',
            closed: false,
          });
        }, 0);
      }

      send(raw) {
        let data = {};
        try {
          data = JSON.parse(raw);
        } catch {
          return;
        }
        if (data.type === 'send') {
          this.#emit({
            type: 'send_ack',
            runId: data.runId,
            interactionId: data.interactionId || 'interaction-e2e-1',
            accepted: true,
            assistantMessage: 'mock assistant reply',
          });
        }
        if (data.type === 'close') {
          this.#emit({
            type: 'close_ack',
            runId: data.runId,
            closed: true,
          });
        }
      }

      close() {
        this.readyState = MockWS.CLOSED;
        if (this.onclose) this.onclose(new CloseEvent('close'));
      }

      #emit(payload) {
        if (!this.onmessage) return;
        this.onmessage(new MessageEvent('message', { data: JSON.stringify(payload) }));
      }
    }

    window.WebSocket = MockWS;
  });
}

export async function installBaseRpcMocks(page, options = {}) {
  const {
    restoreResponse,
    applyOpsHandler,
    startRunResponse,
  } = options;

  await page.route(/\/insightify\.v1\.[^/]+\/[^/?]+$/, async (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;

    const json = (body) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body ?? {}),
      });

    if (pathname.endsWith('/insightify.v1.ProjectService/ListProjects')) {
      return json({
        projects: [
          {
            projectId: PROJECT_ID,
            userId: 'demo-user',
            name: 'Project',
            isActive: true,
          },
        ],
        activeProjectId: PROJECT_ID,
      });
    }

    if (pathname.endsWith('/insightify.v1.ProjectService/SelectProject')) {
      return json({
        project: {
          projectId: PROJECT_ID,
          userId: 'demo-user',
          name: 'Project',
          isActive: true,
        },
      });
    }

    if (pathname.endsWith('/insightify.v1.ProjectService/CreateProject')) {
      return json({
        project: {
          projectId: PROJECT_ID,
          userId: 'demo-user',
          name: 'Project',
          isActive: true,
        },
      });
    }

    if (pathname.endsWith('/insightify.v1.ProjectService/EnsureProject')) {
      return json({ projectId: PROJECT_ID });
    }

    if (pathname.endsWith('/insightify.v1.UiWorkspaceService/GetWorkspace')) {
      return json({
        workspace: {
          workspaceId: 'workspace-e2e-1',
          projectId: PROJECT_ID,
          name: 'Workspace',
          activeTabId: TAB_ID,
        },
        tabs: [
          {
            tabId: TAB_ID,
            workspaceId: 'workspace-e2e-1',
            title: 'Tab',
            runId: restoreResponse?.runId || '',
            orderIndex: 0,
            isPinned: false,
            createdAtUnixMs: Date.now(),
          },
        ],
      });
    }

    if (pathname.endsWith('/insightify.v1.UiWorkspaceService/CreateTab')) {
      return json({
        workspace: {
          workspaceId: 'workspace-e2e-1',
          projectId: PROJECT_ID,
          name: 'Workspace',
          activeTabId: 'tab-created-1',
        },
        tab: {
          tabId: 'tab-created-1',
          workspaceId: 'workspace-e2e-1',
          title: 'Tab',
          runId: '',
          orderIndex: 1,
          isPinned: false,
          createdAtUnixMs: Date.now(),
        },
        tabs: [],
      });
    }

    if (pathname.endsWith('/insightify.v1.UiWorkspaceService/SelectTab')) {
      return json({
        workspace: {
          workspaceId: 'workspace-e2e-1',
          projectId: PROJECT_ID,
          name: 'Workspace',
          activeTabId: TAB_ID,
        },
        tabs: [],
      });
    }

    if (pathname.endsWith('/insightify.v1.UiWorkspaceService/Restore')) {
      return json(
        restoreResponse || {
          reason: UI_RESTORE_REASON_NO_RUN,
          projectId: PROJECT_ID,
          tabId: TAB_ID,
          runId: '',
          document: {
            runId: '',
            version: 0,
            nodes: [],
          },
          documentHash: '',
        },
      );
    }

    if (pathname.endsWith('/insightify.v1.UiService/ApplyOps')) {
      if (applyOpsHandler) {
        return applyOpsHandler(route);
      }
      return json({
        conflict: false,
        currentVersion: 1,
        document: {
          runId: restoreResponse?.runId || 'run-e2e-1',
          version: 1,
          nodes: restoreResponse?.document?.nodes || [],
        },
      });
    }

    if (pathname.endsWith('/insightify.v1.RunService/StartRun')) {
      return json(startRunResponse || { runId: 'run-start-1' });
    }

    return route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: `Unhandled RPC route: ${pathname}` }),
    });
  });
}

export async function seedRestoreCache(page, {
  projectId = PROJECT_ID,
  tabId = TAB_ID,
  runId,
  documentHash,
}) {
  await page.addInitScript(
    ({ projectIdArg, tabIdArg, runIdArg, hashArg }) => {
      localStorage.setItem(`insightify.ui_tab_id.${projectIdArg}`, tabIdArg);
      localStorage.setItem(
        `insightify.ui_doc_meta.${projectIdArg}.${tabIdArg}`,
        JSON.stringify({
          runId: runIdArg,
          documentHash: hashArg,
          savedAt: Date.now(),
        }),
      );
    },
    {
      projectIdArg: projectId,
      tabIdArg: tabId,
      runIdArg: runId,
      hashArg: documentHash,
    },
  );
}
