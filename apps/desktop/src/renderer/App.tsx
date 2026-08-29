import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { AgentEvent, ProviderInstallation } from "@insightify/agent-runtime";
import type {
  ExecutableAgentProvider,
  GraphGenerationEvent,
  ProjectSummary,
  StartRunResult,
} from "@insightify/desktop-bridge";
import {
  buildPortalPreview,
  getDebugAreasForScope,
  getExpandedRoomFrames,
  getNodeAreaIdsForScope,
  layoutFlowNodesWithExpandedScopes,
  projectFlowWithExpandedScopes,
  scopeBoundaryPorts,
  type FlowEdge,
  type FlowNode,
  type GeneratedFlowGraph,
} from "@insightify/graph-domain";
import { semanticLevelForZoom, stageMetrics } from "./semantic-zoom.js";
import { type AppError } from "./lib/errors.js";
import { toAppError } from "./lib/error-normalize.js";
import { providerMeta } from "./lib/constants.js";
import {
  ancestorWithin,
  bundleEdgesByVisualArea,
  buildScopePath,
  clearDive,
  connectionSides,
  descendantIds,
  emptyPreview,
  frameProjection,
  isApprovalRequested,
  isApprovalResolved,
  isRoomEdge,
  layoutBoundaryRail,
  parseEvidence,
  portKey,
  prefersReducedMotion,
  shouldShowNodeAvatar,
  toFlowEdge,
  type RoomEdge,
} from "./lib/flowfold-helpers.js";
import { ErrorBoundary } from "./components/error/ErrorBoundary.js";
import { ProjectRail } from "./components/ProjectRail.js";
import { TopBar } from "./components/TopBar.js";
import { EmptyProject } from "./components/EmptyProject.js";
import { GraphEmpty } from "./components/GraphEmpty.js";
import { PortalCard } from "./components/PortalCard.js";
import { BoundaryPortChip } from "./components/BoundaryPortChip.js";
import { PeekPanel } from "./components/PeekPanel.js";
import { NodeEditor, type NodeDraft } from "./components/NodeEditor.js";
import { EdgeManager, type EdgeDraft } from "./components/EdgeManager.js";
import { ThreadPanel } from "./components/ThreadPanel.js";

type DragState = { nodeId: string; pointerId: number; moved: boolean };
type DiveState = { phase: "exit" | "enter"; scale: number; x: number; y: number };

const emptyNodes: FlowNode[] = [];
const DIVE_MS = 200;
const DIVE_SCALE_IN = 2.6;
const DIVE_SCALE_OUT = 0.42;
const ROOM_TRANSITION_MS = 180;

export function App() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [project, setProject] = useState<ProjectSummary | null>(null);
  const projectIdRef = useRef<string | null>(null);
  const [graph, setGraphState] = useState<GeneratedFlowGraph | null>(null);
  const graphRef = useRef<GeneratedFlowGraph | null>(null);
  const saveQueue = useRef(Promise.resolve());
  const [graphLoading, setGraphLoading] = useState(false);
  const [generatingGraph, setGeneratingGraph] = useState(false);
  const [expandingScopeId, setExpandingScopeId] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProviderInstallation[]>([]);
  const [providerKind, setProviderKind] = useState<ExecutableAgentProvider>("antigravity-cli");
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [prompt, setPrompt] = useState(
    "Review this point in the flow and propose the smallest useful implementation step."
  );
  const [run, setRun] = useState<StartRunResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [currentScopeId, setCurrentScopeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [peekNodeId, setPeekNodeId] = useState<string | null>(null);
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());
  const [expandedScopeIds, setExpandedScopeIds] = useState<Set<string>>(new Set(["api-gateway"]));
  const [closingScopeIds, setClosingScopeIds] = useState<Set<string>>(new Set());
  const [showDebugAreas, setShowDebugAreas] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [dive, setDive] = useState<DiveState | null>(null);
  const [frame, setFrame] = useState({ width: 960, height: 700 });
  const diveTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [nodeDraft, setNodeDraft] = useState<NodeDraft | null>(null);
  const [edgeManagerOpen, setEdgeManagerOpen] = useState(false);
  const [edgeDraft, setEdgeDraft] = useState<EdgeDraft | null>(null);
  const [hoveredEdgeKey, setHoveredEdgeKey] = useState<string | null>(null);
  const canvasRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef<string | null>(null);
  const roomTransitionTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const setGraph = useCallback((value: GeneratedFlowGraph | null) => {
    graphRef.current = value;
    setGraphState(value);
  }, []);

  const reportError = useCallback((reason: unknown) => {
    setError(toAppError(reason));
  }, [setError]);

  const loadGraph = useCallback(
    async (projectId: string) => {
      setGraphLoading(true);
      try {
        const value = await window.insightify.getProjectGraph(projectId);
        if (projectIdRef.current === projectId) {
          setGraph(value);
        }
      } catch (reason) {
        reportError(reason);
      } finally {
        if (projectIdRef.current === projectId) {
          setGraphLoading(false);
        }
      }
    },
    [reportError, setGraph]
  );

  useEffect(() => {
    void Promise.all([window.insightify.listProjects(), window.insightify.probeProviders()])
      .then(([knownProjects, installations]) => {
        setProjects(knownProjects);
        setProviders(installations);
        if (!installations.some((item) => item.provider === "antigravity-cli" && item.installed)) {
          if (installations.some((item) => item.provider === "codex" && item.installed)) {
            setProviderKind("codex");
          }
        }
        const initial = knownProjects[0] ?? null;
        setProject(initial);
        projectIdRef.current = initial?.id ?? null;
        if (initial) {
          void loadGraph(initial.id);
        }
      })
      .catch((reason) => reportError(reason));

    const offAgent = window.insightify.onAgentEvent((event) => {
      setEvents((current) => [...current.slice(-499), event]);
      if (event.type === "run.completed" || event.type === "run.failed") {
        setBusy(false);
        setRun(null);
      }
    });

    const offGraph = window.insightify.onGraphGeneration((event: GraphGenerationEvent) => {
      setGeneratingGraph(false);
      setExpandingScopeId(null);
      setBusy(false);
      setRun(null);
      setEvents([]);
      if (event.status === "completed") {
        if (event.value.projectId === projectIdRef.current) {
          setGraph(event.value);
          if (!event.scopeNodeId) setCurrentScopeId(null);
        }
      } else if (event.projectId === projectIdRef.current) {
        reportError(event.message);
      }
    });

    return () => {
      offAgent();
      offGraph();
    };
  }, [loadGraph, reportError, setGraph]);

  useEffect(() => () => clearDive(diveTimers), []);
  useEffect(
    () => () => {
      roomTransitionTimers.current.forEach(clearTimeout);
      roomTransitionTimers.current.clear();
    },
    []
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver(([entry]) =>
      setFrame({ width: entry.contentRect.width, height: entry.contentRect.height })
    );
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [project, graph]);

  // Derive valid scope ID: if the currently selected scope no longer exists in graph, fall back to null
  const activeScopeId = useMemo(() => {
    if (!currentScopeId || !graph) return null;
    return graph.graph.nodes.some((node) => node.id === currentScopeId) ? currentScopeId : null;
  }, [graph, currentScopeId]);

  const provider = providers.find((item) => item.provider === providerKind) ?? null;
  const meta = providerMeta[providerKind];
  const renderedExpandedScopeIds = useMemo(
    () => new Set([...expandedScopeIds, ...closingScopeIds]),
    [expandedScopeIds, closingScopeIds]
  );
  const projection = useMemo(
    () =>
      graph
        ? projectFlowWithExpandedScopes(graph.graph, activeScopeId, renderedExpandedScopeIds)
        : null,
    [graph, activeScopeId, renderedExpandedScopeIds]
  );
  const visibleNodes = projection?.nodes ?? emptyNodes;
  const roomEdges = useMemo(
    () => (projection?.edges ?? []).filter(isRoomEdge) as RoomEdge[],
    [projection]
  );
  const boundaryPorts = useMemo(
    () => (graph ? scopeBoundaryPorts(graph.graph, activeScopeId) : []),
    [graph, activeScopeId]
  );
  const flowLayout = useMemo(
    () =>
      layoutFlowNodesWithExpandedScopes(
        visibleNodes,
        activeScopeId,
        renderedExpandedScopeIds,
        roomEdges.map(toFlowEdge),
        graph?.layout
      ),
    [visibleNodes, activeScopeId, renderedExpandedScopeIds, roomEdges, graph?.layout]
  );
  const stage = useMemo(
    () => stageMetrics(
      flowLayout
        .filter((node) => !renderedExpandedScopeIds.has(node.id))
        .map((node) => ({
          ...node,
          width: node.parentId === activeScopeId ? 190 : 154,
          height: node.parentId === activeScopeId ? 82 : 60,
        })),
      frame
    ),
    [flowLayout, frame, renderedExpandedScopeIds, activeScopeId]
  );
  const stageZoom = zoom * stage.scale;
  const lod = useMemo(() => semanticLevelForZoom("flow", stageZoom), [stageZoom]);
  const debugAreas = useMemo(
    () => getDebugAreasForScope(activeScopeId, visibleNodes),
    [activeScopeId, visibleNodes]
  );
  const roomFrames = useMemo(
    () =>
      getExpandedRoomFrames(
        visibleNodes,
        activeScopeId,
        renderedExpandedScopeIds,
        roomEdges.map(toFlowEdge),
        graph?.layout
      ),
    [visibleNodes, activeScopeId, renderedExpandedScopeIds, roomEdges, graph?.layout]
  );

  const positionedNodes = flowLayout;
  const visibleIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);
  const editableEdges = useMemo(
    () =>
      graph?.graph.edges
        .map((edge, index) => ({ edge, index }))
        .filter(({ edge }) => visibleIds.has(edge.source) && visibleIds.has(edge.target)) ?? [],
    [graph, visibleIds]
  );
  const previews = useMemo(
    () =>
      new Map(
        graph
          ? visibleNodes.map((node) => [node.id, buildPortalPreview(graph.graph, node.id)] as const)
          : []
      ),
    [visibleNodes, graph]
  );
  const positions = useMemo(
    () => new Map(positionedNodes.map((node) => [node.id, node])),
    [positionedNodes]
  );
  const areaIds = useMemo(
    () => getNodeAreaIdsForScope(
      activeScopeId,
      positionedNodes.filter((node) => node.parentId === activeScopeId)
    ),
    [activeScopeId, positionedNodes]
  );
  const visualEdges = useMemo(
    () => bundleEdgesByVisualArea(
      roomEdges,
      positionedNodes,
      activeScopeId,
      areaIds,
      roomFrames
    ),
    [roomEdges, positionedNodes, activeScopeId, areaIds, roomFrames]
  );
  const hoveredEdge = visualEdges.find((edge) => edge.key === hoveredEdgeKey) ?? null;
  const projected = useMemo(
    () => frameProjection(stage.width, stage.height, stageZoom, frame),
    [stage, stageZoom, frame]
  );
  const portRail = useMemo(
    () => layoutBoundaryRail(boundaryPorts, positionedNodes, projected),
    [boundaryPorts, positionedNodes, projected]
  );
  const selectedNode = graph?.graph.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const peekNode = graph?.graph.nodes.find((node) => node.id === peekNodeId) ?? null;
  const scopePath = useMemo(() => buildScopePath(graph, activeScopeId), [graph, activeScopeId]);
  const scopeNode = activeScopeId
    ? graph?.graph.nodes.find((node) => node.id === activeScopeId) ?? null
    : null;

  const transcript = useMemo(
    () =>
      events
        .filter((event) => event.type === "assistant.delta")
        .map((event) => event.text)
        .join(""),
    [events]
  );

  const approvals = useMemo(() => {
    const resolved = new Set(events.filter(isApprovalResolved).map((event) => event.requestId));
    return events.filter(isApprovalRequested).filter((event) => !resolved.has(event.requestId));
  }, [events]);

  function resetView() {
    clearDive(diveTimers);
    setDive(null);
    setCurrentScopeId(null);
    setSelectedNodeId(null);
    setPeekNodeId(null);
    setEvents([]);
    setRun(null);
    setZoom(1);
  }

  const toggleScopeExpand = useCallback(
    (roomId: string) => {
      const pending = roomTransitionTimers.current.get(roomId);
      if (pending) {
        clearTimeout(pending);
        roomTransitionTimers.current.delete(roomId);
      }

      if (expandedScopeIds.has(roomId)) {
        setExpandedScopeIds((current) => {
          const next = new Set(current);
          next.delete(roomId);
          return next;
        });
        setClosingScopeIds((current) => new Set(current).add(roomId));
        const timer = setTimeout(() => {
          setClosingScopeIds((current) => {
            const next = new Set(current);
            next.delete(roomId);
            return next;
          });
          roomTransitionTimers.current.delete(roomId);
        }, ROOM_TRANSITION_MS);
        roomTransitionTimers.current.set(roomId, timer);
      } else {
        setClosingScopeIds((current) => {
          const next = new Set(current);
          next.delete(roomId);
          return next;
        });
        setExpandedScopeIds((current) => new Set(current).add(roomId));
      }
    },
    [expandedScopeIds]
  );

  const expandAllRooms = useCallback(() => {
    if (!graph) return;
    roomTransitionTimers.current.forEach(clearTimeout);
    roomTransitionTimers.current.clear();
    const roomIds = graph.graph.nodes
      .filter((n) => n.kind === "room" && n.parentId === activeScopeId)
      .map((n) => n.id);
    setClosingScopeIds(new Set());
    setExpandedScopeIds(new Set(roomIds));
  }, [graph, activeScopeId]);

  const collapseAllRooms = useCallback(() => {
    roomTransitionTimers.current.forEach(clearTimeout);
    roomTransitionTimers.current.clear();
    const closing = new Set(expandedScopeIds);
    setClosingScopeIds(closing);
    setExpandedScopeIds(new Set());
    for (const roomId of closing) {
      const timer = setTimeout(() => {
        setClosingScopeIds((current) => {
          const next = new Set(current);
          next.delete(roomId);
          return next;
        });
        roomTransitionTimers.current.delete(roomId);
      }, ROOM_TRANSITION_MS);
      roomTransitionTimers.current.set(roomId, timer);
    }
  }, [expandedScopeIds]);

  function selectProject(selected: ProjectSummary) {
    projectIdRef.current = selected.id;
    setProject(selected);
    setGraph(null);
    resetView();
    setError(null);
    void loadGraph(selected.id);
  }

  async function pickProject() {
    setError(null);
    try {
      const selected = await window.insightify.pickProject();
      if (!selected) return;
      setProjects((current) => [selected, ...current.filter((item) => item.id !== selected.id)]);
      selectProject(selected);
    } catch (reason) {
      reportError(reason);
    }
  }

  function persistGraph(value: GeneratedFlowGraph) {
    setGraph(value);
    saveQueue.current = saveQueue.current
      .then(async () => {
        await window.insightify.saveProjectGraph(value);
      })
      .catch((reason) => reportError(reason));
  }

  function locallyUpdateGraph(update: (current: GeneratedFlowGraph) => GeneratedFlowGraph) {
    const current = graphRef.current;
    if (!current) return null;
    const next = update(current);
    setGraph(next);
    return next;
  }

  function mutateGraph(update: (current: GeneratedFlowGraph) => GeneratedFlowGraph) {
    const current = graphRef.current;
    if (current) persistGraph(update(current));
  }

  async function generateGraph(scopeNodeId?: string) {
    if (!project || !provider?.installed) return;
    setBusy(true);
    setGeneratingGraph(!scopeNodeId);
    setExpandingScopeId(scopeNodeId ?? null);
    setError(null);
    setEvents([]);
    try {
      const result = await window.insightify.generateFlowGraph({
        provider: providerKind,
        projectId: project.id,
        ...(scopeNodeId ? { scopeNodeId } : {}),
      });
      setRun(result);
    } catch (reason) {
      setBusy(false);
      setGeneratingGraph(false);
      setExpandingScopeId(null);
      reportError(reason);
    }
  }

  async function startRun() {
    if (!project || !prompt.trim()) return;
    setBusy(true);
    setError(null);
    setEvents([]);
    const anchor = selectedNode ?? scopeNode;
    const anchoredPrompt = [
      "INSIGHTIFY_FLOWFOLD_ANCHOR",
      `Project: ${project.displayName}`,
      `Graph: ${graph?.graph.title ?? "not generated"}`,
      `Room path: Root${scopePath.map((node) => ` / ${node.title}`).join("")}`,
      anchor
        ? `Selected node: ${anchor.title}\nNode kind: ${anchor.kind}\nNode summary: ${
            anchor.summary
          }\nTags: ${anchor.tags?.join(", ") || "none"}\nEvidence: ${
            anchor.evidence.join(", ") || "none"
          }${anchor.codeSnippet ? `\nCode:\n${anchor.codeSnippet}` : ""}`
        : "Selected node: root scope",
      "Treat this anchor as the working context. Propose implementation code clearly for copying.",
      "",
      prompt,
    ].join("\n");

    try {
      const result = await window.insightify.startAgentRun({
        provider: providerKind,
        projectId: project.id,
        prompt: anchoredPrompt,
      });
      setRun(result);
    } catch (reason) {
      setBusy(false);
      reportError(reason);
    }
  }

  async function cancelRun() {
    if (!project || !run) return;
    try {
      await window.insightify.cancelAgentRun({
        provider: providerKind,
        projectId: project.id,
        threadId: run.threadId,
        runId: run.runId,
      });
    } catch (reason) {
      reportError(reason);
    }
  }

  async function respondApproval(requestId: string, decision: "accept" | "decline") {
    if (!project) return;
    try {
      await window.insightify.respondToAgentApproval({
        provider: "codex",
        projectId: project.id,
        requestId,
        decision,
      });
    } catch (reason) {
      reportError(reason);
    }
  }

  function enterRoom(node: FlowNode) {
    if (busy) return;
    const origin = positions.get(node.id);
    diveTo(DIVE_SCALE_IN, origin?.x ?? 50, origin?.y ?? 50, () => {
      setCurrentScopeId(node.id);
      setSelectedNodeId(null);
      setPeekNodeId(null);
      setEvents([]);
      setZoom(1);
      const hasChildren =
        graphRef.current?.graph.nodes.some((candidate) => candidate.parentId === node.id) ?? false;
      if (!hasChildren) void generateGraph(node.id);
    });
  }

  function navigateToScope(scopeId: string | null) {
    if (busy) return;
    const ownerId = ancestorWithin(graph, activeScopeId, scopeId);
    const owner = ownerId ? graph?.layout[ownerId] : undefined;
    diveTo(DIVE_SCALE_OUT, owner?.x ?? 50, owner?.y ?? 50, () => {
      setCurrentScopeId(scopeId);
      setSelectedNodeId(ownerId);
      setPeekNodeId(null);
      setEvents([]);
      setZoom(1);
    });
  }

  function diveTo(scale: number, x: number, y: number, commit: () => void) {
    clearDive(diveTimers);
    if (prefersReducedMotion()) {
      setDive(null);
      commit();
      return;
    }
    setDive({ phase: "exit", scale, x, y });
    diveTimers.current.push(
      setTimeout(() => {
        commit();
        setDive({ phase: "enter", scale, x, y });
        diveTimers.current.push(setTimeout(() => setDive(null), DIVE_MS + 40));
      }, DIVE_MS)
    );
  }

  function toggleNodeExpansion(nodeId: string) {
    setExpandedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }

  function expandAllNodes() {
    setExpandedNodeIds(new Set(visibleNodes.map((n) => n.id)));
  }

  function collapseAllNodes() {
    setExpandedNodeIds(new Set());
  }

  function handleWheel(event: React.WheelEvent<HTMLElement>) {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      const delta = -event.deltaY * 0.003;
      setZoom((current) => Math.min(5.0, Math.max(0.2, +(current + delta).toFixed(2))));
    }
  }

  function askAiAboutNode(node: FlowNode) {
    setSelectedNodeId(node.id);
    setPrompt(
      `Examine node "${node.title}" (${node.kind}) and propose the code implementation or changes to be copied.`
    );
  }

  function openEditNode(node: FlowNode) {
    setSelectedNodeId(node.id);
    setNodeDraft({
      nodeId: node.id,
      title: node.title,
      summary: node.summary,
      kind: node.kind,
      technology: node.technology ?? "",
      evidence: node.evidence.join("\n"),
      tags: node.tags?.join(", ") ?? "",
      status: node.status ?? "idle",
      codeSnippet: node.codeSnippet ?? "",
    });
  }

  function saveNodeDraft() {
    if (
      !nodeDraft ||
      !nodeDraft.title.trim() ||
      !nodeDraft.summary.trim() ||
      !graphRef.current
    )
      return;

    const parsedTags = nodeDraft.tags
      .split(",")
      .map((t) => t.trim().replace(/^#/, ""))
      .filter(Boolean)
      .slice(0, 6);

    mutateGraph((current) => ({
      ...current,
      graph: {
        ...current.graph,
        nodes: current.graph.nodes.map((node) =>
          node.id === nodeDraft.nodeId
            ? {
                ...node,
                title: nodeDraft.title.trim(),
                summary: nodeDraft.summary.trim(),
                kind: nodeDraft.kind,
                technology: nodeDraft.technology.trim() || undefined,
                evidence: parseEvidence(nodeDraft.evidence),
                tags: parsedTags.length ? parsedTags : undefined,
                status: nodeDraft.status,
                codeSnippet: nodeDraft.codeSnippet.trim() || undefined,
              }
            : node
        ),
      },
    }));
    setNodeDraft(null);
  }

  function deleteNode(nodeId: string) {
    const current = graphRef.current;
    const node = current?.graph.nodes.find((item) => item.id === nodeId);
    if (!current || !node || !window.confirm(`Delete “${node.title}” and all nested nodes?`))
      return;
    const removed = descendantIds(current.graph.nodes, nodeId);
    mutateGraph((value) => ({
      ...value,
      graph: {
        ...value.graph,
        nodes: value.graph.nodes.filter((item) => !removed.has(item.id)),
        edges: value.graph.edges.filter(
          (edge) => !removed.has(edge.source) && !removed.has(edge.target)
        ),
      },
      layout: Object.fromEntries(
        Object.entries(value.layout).filter(([id]) => !removed.has(id))
      ),
    }));
    setNodeDraft(null);
    setSelectedNodeId(null);
    setPeekNodeId(null);
  }

  function startNewEdge() {
    if (visibleNodes.length < 2) {
      reportError("Create at least two nodes in this Room before connecting them.");
      return;
    }
    setEdgeDraft({
      index: null,
      source: visibleNodes[0].id,
      target: visibleNodes[1].id,
      label: "",
    });
  }

  function saveEdgeDraft() {
    if (!edgeDraft || edgeDraft.source === edgeDraft.target) {
      reportError("An edge must connect two different nodes.");
      return;
    }
    const edge: FlowEdge = {
      source: edgeDraft.source,
      target: edgeDraft.target,
      label: edgeDraft.label.trim(),
    };
    mutateGraph((current) => ({
      ...current,
      graph: {
        ...current.graph,
        edges:
          edgeDraft.index === null
            ? [...current.graph.edges, edge]
            : current.graph.edges.map((item, index) => (index === edgeDraft.index ? edge : item)),
      },
    }));
    setEdgeDraft(null);
  }

  function deleteEdge(index: number) {
    mutateGraph((current) => ({
      ...current,
      graph: {
        ...current.graph,
        edges: current.graph.edges.filter((_edge, edgeIndex) => edgeIndex !== index),
      },
    }));
    setEdgeDraft(null);
  }

  function onNodePointerDown(event: ReactPointerEvent<HTMLElement>, nodeId: string) {
    if (event.button !== 0 || busy || (event.target as HTMLElement).closest("button")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { nodeId, pointerId: event.pointerId, moved: false };
    setSelectedNodeId(nodeId);
    setPeekNodeId(null);
  }

  function onNodePointerMove(event: ReactPointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    const canvas = canvasRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    let x =
      50 + (((event.clientX - rect.left - rect.width / 2) / stageZoom / stage.width) * 100);
    let y =
      50 + (((event.clientY - rect.top - rect.height / 2) / stageZoom / stage.height) * 100);
    const draggedNode = graphRef.current?.graph.nodes.find((node) => node.id === drag.nodeId);
    const parentFrame = draggedNode?.parentId
      ? roomFrames.find((roomFrame) => roomFrame.roomId === draggedNode.parentId)
      : undefined;
    const ownFrame = roomFrames.find((roomFrame) => roomFrame.roomId === drag.nodeId);

    if (parentFrame) {
      // Persist nested-node drags in the Room's local 0–100 coordinate system.
      x = Math.min(
        96,
        Math.max(4, ((x - parentFrame.contentBounds.x) / parentFrame.contentBounds.width) * 100)
      );
      y = Math.min(
        96,
        Math.max(4, ((y - parentFrame.contentBounds.y) / parentFrame.contentBounds.height) * 100)
      );
    } else if (ownFrame) {
      // Keep a dragged group fully on the canvas, not merely its center point.
      x = Math.min(99 - ownFrame.bounds.width / 2, Math.max(1 + ownFrame.bounds.width / 2, x));
      y = Math.min(97 - ownFrame.bounds.height / 2, Math.max(3 + ownFrame.bounds.height / 2, y));
    } else {
      x = Math.min(92, Math.max(8, x));
      y = Math.min(87, Math.max(15, y));
    }
    drag.moved = true;
    locallyUpdateGraph((current) => ({
      ...current,
      layout: { ...current.layout, [drag.nodeId]: { x, y } },
    }));
  }

  function onNodePointerUp(event: ReactPointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (drag.moved) {
      suppressClickRef.current = drag.nodeId;
      setTimeout(() => {
        if (suppressClickRef.current === drag.nodeId) suppressClickRef.current = null;
      }, 0);
      if (graphRef.current) persistGraph(graphRef.current);
    }
  }

  return (
    <ErrorBoundary>
      <div className="app-shell">
        <ProjectRail
          projects={projects}
          selectedProject={project}
          busy={busy}
          onPick={pickProject}
          onSelect={selectProject}
        />

        <main className="workspace">
          <TopBar
            project={project}
            graph={graph}
            scopePath={scopePath}
            scopeNode={scopeNode}
            visibleNodesCount={visibleNodes.length}
            boundaryPortsCount={boundaryPorts.length}
            lod={lod}
            busy={busy}
            provider={provider}
            providers={providers}
            providerKind={providerKind}
            onNavigateToScope={navigateToScope}
            onRegenerateGraph={() => void generateGraph()}
            onSelectProvider={(kind) => {
              setProviderKind(kind);
              setEvents([]);
              setRun(null);
              setError(null);
            }}
          />

          <section className="canvas-frame" ref={canvasRef} onWheel={handleWheel}>
            {!project && <EmptyProject onPick={pickProject} />}
            {project && !graph && (
              <GraphEmpty
                loading={graphLoading}
                generating={generatingGraph}
                provider={provider}
                meta={meta}
                run={run}
                onGenerate={generateGraph}
                onCancel={cancelRun}
              />
            )}
            {project && graph && (
              <>
                <div className="canvas-toolbar">
                  {activeScopeId && (
                    <button
                      type="button"
                      onClick={() => navigateToScope(scopeNode?.parentId ?? null)}
                    >
                      ← Back
                    </button>
                  )}
                  {activeScopeId && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void generateGraph(activeScopeId)}
                    >
                      ✦ Expand with {meta.label}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setEdgeManagerOpen(true);
                      setEdgeDraft(null);
                    }}
                  >
                    ↗ Edges <span>{editableEdges.length}</span>
                  </button>
                  <button
                    type="button"
                    onClick={expandedScopeIds.size > 0 ? collapseAllRooms : expandAllRooms}
                    title={expandedScopeIds.size > 0 ? "すべてのRoomを折りたたむ" : "すべてのRoomをインライン展開"}
                  >
                    🚪 Rooms {expandedScopeIds.size > 0 ? `(${expandedScopeIds.size} open)` : "⊞ Expand"}
                  </button>
                  <button
                    type="button"
                    className={showDebugAreas ? "active" : ""}
                    onClick={() => setShowDebugAreas(!showDebugAreas)}
                    title="再帰的エリアDSLの境界と色を表示/非表示"
                  >
                    🗺️ Areas {showDebugAreas ? "ON" : "OFF"}
                  </button>
                </div>
                <div className="scope-label">
                  <span>ROOM</span> {scopeNode?.title ?? graph.graph.title}
                </div>
                {visibleNodes.length === 0 && (
                  <div className="empty-scope">
                    <strong>
                      {expandingScopeId === activeScopeId
                        ? `${meta.label} is decomposing this Room…`
                        : "This Room has not been decomposed yet."}
                    </strong>
                    <p>
                      {expandingScopeId === activeScopeId
                        ? "Existing Graph entities are locked while new child Nodes are validated."
                        : "Room expansion normally starts automatically when you enter."}
                    </p>
                    {expandingScopeId === activeScopeId ? (
                      <button className="stop-button" onClick={cancelRun} type="button">
                        Stop expansion
                      </button>
                    ) : (
                      activeScopeId && (
                        <button
                          className="primary-button"
                          disabled={busy || !provider?.installed}
                          onClick={() => void generateGraph(activeScopeId)}
                          type="button"
                        >
                          Retry with {meta.label}
                        </button>
                      )
                    )}
                  </div>
                )}
                <div className="room-stack" aria-hidden="true">
                  {scopePath.slice(-3).map((node, index) => (
                    <i key={node.id} style={{ "--fold": index + 1 } as CSSProperties} />
                  ))}
                </div>
                <div
                  className={`graph-stage lod-${lod}${dive ? ` dive-${dive.phase}` : ""}`}
                  style={
                    {
                      width: stage.width,
                      height: stage.height,
                      "--stage-zoom": stageZoom,
                      "--dive-scale": dive?.scale ?? 1,
                      "--dive-x": `${dive?.x ?? 50}%`,
                      "--dive-y": `${dive?.y ?? 50}%`,
                    } as CSSProperties
                  }
                >
                  {/* Visual Debug Areas with Pastel Colors */}
                  {showDebugAreas && (
                    <div className="debug-areas-layer" aria-hidden="true">
                      {debugAreas.map((area) => (
                        <div
                          key={area.id}
                          className="debug-area-box"
                          style={{
                            left: `${area.bounds.x}%`,
                            top: `${area.bounds.y}%`,
                            width: `${area.bounds.width}%`,
                            height: `${area.bounds.height}%`,
                            backgroundColor: area.backgroundColor,
                            borderColor: area.borderColor,
                          }}
                        >
                          <span
                            className="debug-area-badge"
                            style={{
                              color: area.textColor,
                              borderColor: area.borderColor,
                            }}
                          >
                            {area.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Visual Expanded Room Container Frames */}
                  {roomFrames.map((frame) => (
                    <div
                      key={`room-frame-${frame.roomId}`}
                      className={`expanded-room-frame${
                        closingScopeIds.has(frame.roomId) ? " is-closing" : ""
                      }`}
                      style={{
                        left: `${frame.bounds.x}%`,
                        top: `${frame.bounds.y}%`,
                        width: `${frame.bounds.width}%`,
                        height: `${frame.bounds.height}%`,
                      }}
                    >
                      <div
                        aria-label={`${frame.title} Room. Drag to move the group.`}
                        className="room-frame-header"
                        onPointerDown={(event) => onNodePointerDown(event, frame.roomId)}
                        onPointerMove={onNodePointerMove}
                        onPointerUp={onNodePointerUp}
                        onPointerCancel={onNodePointerUp}
                        title="ドラッグしてRoom全体を移動"
                      >
                        <span className="room-frame-grip" aria-hidden="true">
                          <i />
                          <i />
                          <i />
                          <i />
                          <i />
                          <i />
                        </span>
                        <span className="room-frame-badge">Room</span>
                        <span className="room-frame-title">{frame.title}</span>
                        <span className="room-frame-count">{frame.childCount}</span>
                        <button
                          type="button"
                          className="room-frame-fold-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleScopeExpand(frame.roomId);
                          }}
                          title="内部ノードを折りたたむ"
                        >
                          <span aria-hidden="true">−</span> Fold
                        </button>
                      </div>
                    </div>
                  ))}

                  <svg
                    className="edge-layer"
                    viewBox="0 0 1000 620"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <defs>
                      <marker
                        id="flow-arrow"
                        markerWidth="8"
                        markerHeight="8"
                        refX="7"
                        refY="3.4"
                        orient="auto"
                      >
                        <path d="M 0 0 L 8 3.4 L 0 6.8 z" />
                      </marker>
                    </defs>
                    {visualEdges.map((edge) => {
                      const sx = edge.sourceX * 10;
                      const sy = edge.sourceY * 6.2;
                      const tx = edge.targetX * 10;
                      const ty = edge.targetY * 6.2;
                      const path = `M ${sx} ${sy} C ${(sx + tx) / 2} ${sy}, ${
                        (sx + tx) / 2
                      } ${ty}, ${tx} ${ty}`;
                      return (
                        <g
                          className={`flow-edge${edge.bundled ? " bundled area-bundle" : ""}${
                            hoveredEdgeKey === edge.key ? " hovered" : ""
                          }`}
                          key={edge.key}
                          onMouseEnter={() => edge.bundled && setHoveredEdgeKey(edge.key)}
                          onMouseLeave={() => edge.bundled && setHoveredEdgeKey(null)}
                        >
                          {edge.bundled && <path className="edge-hit-target" d={path} />}
                          <path
                            className="edge-visible-path"
                            d={path}
                            markerEnd="url(#flow-arrow)"
                            style={{
                              strokeWidth: edge.bundled
                                ? Math.min(5.2, 1.9 + Math.log2(edge.count + 1) * 0.85)
                                : undefined,
                            }}
                          />
                        </g>
                      );
                    })}
                  </svg>
                  {positionedNodes.map((node) => (
                    <PortalCard
                      key={node.id}
                      node={node}
                      preview={previews.get(node.id) ?? emptyPreview}
                      lod={lod}
                      selected={selectedNodeId === node.id}
                      isExpanded={expandedNodeIds.has(node.id)}
                      onToggleExpand={() => toggleNodeExpansion(node.id)}
                      isScopeExpanded={renderedExpandedScopeIds.has(node.id)}
                      onToggleScopeExpand={() => toggleScopeExpand(node.id)}
                      isNestedChild={node.parentId !== activeScopeId}
                      isLeavingScope={
                        node.parentId !== activeScopeId &&
                        closingScopeIds.has(node.parentId ?? "")
                      }
                      showAvatar={shouldShowNodeAvatar(node, visibleNodes)}
                      connections={connectionSides(node.id, roomEdges, boundaryPorts)}
                      onSelect={() => {
                        if (suppressClickRef.current === node.id) {
                          suppressClickRef.current = null;
                          return;
                        }
                        setSelectedNodeId(node.id);
                        setEvents([]);
                        toggleNodeExpansion(node.id);
                      }}
                      onPeek={() => setPeekNodeId(node.id)}
                      onEnter={() => enterRoom(node)}
                      onEdit={() => openEditNode(node)}
                      onAskAi={() => askAiAboutNode(node)}
                      onPointerDown={(event) => onNodePointerDown(event, node.id)}
                      onPointerMove={onNodePointerMove}
                      onPointerUp={onNodePointerUp}
                    />
                  ))}
                </div>

                {!dive &&
                  lod !== "structure" &&
                  visualEdges.map((edge) => {
                    const label = edge.bundled
                      ? `${edge.count} connections`
                      : edge.members[0]?.labels[0] ?? "";
                    if (!label) return null;
                    return (
                      <span
                        className={`edge-label${edge.bundled ? " bundle-label" : ""}`}
                        key={`label-${edge.key}`}
                        style={{
                          left: `${projected.x((edge.sourceX + edge.targetX) / 2)}%`,
                          top: `${
                            projected.y((edge.sourceY + edge.targetY) / 2) -
                            projected.cardHalfHeight -
                            2.2
                          }%`,
                        }}
                      >
                        {label}
                      </span>
                    );
                  })}

                {!dive && hoveredEdge?.bundled && (
                  <div
                    className="edge-bundle-popover"
                    style={{
                      left: `${projected.x((hoveredEdge.sourceX + hoveredEdge.targetX) / 2)}%`,
                      top: `${projected.y((hoveredEdge.sourceY + hoveredEdge.targetY) / 2)}%`,
                    }}
                  >
                    <header>
                      <span>AREA FLOW</span>
                      <b>{hoveredEdge.count} connections</b>
                    </header>
                    <ul>
                      {hoveredEdge.members.slice(0, 6).map((edge) => (
                        <li key={`${edge.source}-${edge.target}`}>
                          <span>
                            {positions.get(edge.source)?.title ?? edge.source}
                            <i>→</i>
                            {positions.get(edge.target)?.title ?? edge.target}
                          </span>
                          <em>
                            {edge.labels.join(" · ") || "flow"}
                            {edge.count > 1 ? ` ×${edge.count}` : ""}
                          </em>
                        </li>
                      ))}
                    </ul>
                    {hoveredEdge.members.length > 6 && (
                      <small>+{hoveredEdge.members.length - 6} more</small>
                    )}
                  </div>
                )}

                {!dive && portRail.length > 0 && (
                  <svg
                    className="boundary-layer"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <defs>
                      <marker
                        id="boundary-arrow"
                        markerWidth="8"
                        markerHeight="8"
                        refX="7"
                        refY="3.4"
                        orient="auto"
                      >
                        <path d="M 0 0 L 8 3.4 L 0 6.8 z" />
                      </marker>
                    </defs>
                    {portRail.map((placed) => (
                      <path
                        className="boundary-link"
                        d={
                          placed.port.side === "input"
                            ? `M ${placed.fromX} ${placed.fromY} L ${placed.toX} ${placed.fromY} L ${placed.toX} ${placed.toY}`
                            : `M ${placed.toX} ${placed.toY} L ${placed.toX} ${placed.fromY} L ${placed.fromX} ${placed.fromY}`
                        }
                        key={`link-${portKey(placed.port)}`}
                        markerEnd="url(#boundary-arrow)"
                      />
                    ))}
                  </svg>
                )}

                {!dive &&
                  portRail.map((placed) => (
                    <BoundaryPortChip
                      key={portKey(placed.port)}
                      port={placed.port}
                      lod={lod}
                      left={placed.chipX}
                      top={placed.chipY}
                    />
                  ))}

                <div className="zoom-indicator">
                  <button
                    aria-label="すべて折りたたむ"
                    title="全ノードを折りたたむ"
                    onClick={collapseAllNodes}
                    type="button"
                  >
                    ⊟
                  </button>
                  <button
                    aria-label="すべて展開"
                    title="全ノードを展開する"
                    onClick={expandAllNodes}
                    type="button"
                  >
                    ⊞
                  </button>
                  <button
                    aria-label="縮小"
                    onClick={() =>
                      setZoom((value) => Math.min(5.0, Math.max(0.2, +(value - 0.25).toFixed(2))))
                    }
                    type="button"
                  >
                    −
                  </button>
                  <span
                    onClick={() => setZoom(+(1 / (stage.scale || 1)).toFixed(2))}
                    title="クリックで 100% にリセット"
                    style={{ cursor: "pointer" }}
                  >
                    {Math.round(stageZoom * 100)}% · {lod}
                  </span>
                  <button
                    aria-label="拡大"
                    onClick={() =>
                      setZoom((value) => Math.min(5.0, Math.max(0.2, +(value + 0.25).toFixed(2))))
                    }
                    type="button"
                  >
                    ＋
                  </button>
                </div>

                {peekNode && (
                  <PeekPanel
                    node={peekNode}
                    graph={graph}
                    onClose={() => setPeekNodeId(null)}
                    onEnter={() => enterRoom(peekNode)}
                    onEdit={() => openEditNode(peekNode)}
                    onAskAi={() => askAiAboutNode(peekNode)}
                  />
                )}

                {edgeManagerOpen && (
                  <EdgeManager
                    nodes={visibleNodes}
                    edges={editableEdges}
                    draft={edgeDraft}
                    onDraft={setEdgeDraft}
                    onNew={startNewEdge}
                    onSave={saveEdgeDraft}
                    onDelete={deleteEdge}
                    onClose={() => {
                      setEdgeManagerOpen(false);
                      setEdgeDraft(null);
                    }}
                  />
                )}
              </>
            )}
          </section>
        </main>

        <ThreadPanel
          project={project}
          graph={graph}
          anchor={selectedNode ?? scopeNode}
          events={events}
          approvals={approvals}
          transcript={transcript}
          generating={generatingGraph || expandingScopeId !== null}
          provider={provider}
          providerKind={providerKind}
          meta={meta}
          prompt={prompt}
          busy={busy}
          run={run}
          error={error}
          onPrompt={setPrompt}
          onRun={startRun}
          onCancel={cancelRun}
          onErrorDismiss={() => setError(null)}
          onRespondApproval={respondApproval}
        />

        {nodeDraft && (
          <NodeEditor
            draft={nodeDraft}
            onChange={setNodeDraft}
            onSave={saveNodeDraft}
            onDelete={nodeDraft.nodeId ? () => deleteNode(nodeDraft.nodeId!) : null}
            onClose={() => setNodeDraft(null)}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}
