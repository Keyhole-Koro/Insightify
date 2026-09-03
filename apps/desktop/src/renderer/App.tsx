import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { isRoom, roomsInScope, type FlowNode, type GeneratedFlowGraph } from "@insightify/graph-domain";
import type { GenerationMode, ProjectSummary } from "@insightify/desktop-bridge";
import { type AppError } from "./lib/errors.js";
import { toAppError } from "./lib/error-normalize.js";
import {
  ancestorWithin,
  connectionSides,
  emptyPreview,
  portKey,
  shouldShowNodeAvatar,
} from "./lib/flowfold-helpers.js";
import {
  isLayoutAreaLocked,
  patchNode,
  removeEdgeAt,
  removeNodeAndDescendants,
  toggleLayoutAreaLock,
  upsertEdge,
} from "./lib/graph-edits.js";
import {
  isNodeDraftComplete,
  nodeDraftFromNode,
  nodePatchFromDraft,
  type NodeDraft,
} from "./lib/node-draft.js";
import { DEFAULT_PROMPT, buildAnchoredPrompt, buildNodeQuestionPrompt } from "./lib/prompts.js";
import { useAgentSession } from "./hooks/useAgentSession.js";
import { DIVE_SCALE_IN, DIVE_SCALE_OUT, useCanvasView } from "./hooks/useCanvasView.js";
import { useFlowProjection } from "./hooks/useFlowProjection.js";
import { useNodeDrag } from "./hooks/useNodeDrag.js";
import { useProjectGraph, type GraphUpdate } from "./hooks/useProjectGraph.js";
import { ErrorBoundary } from "./components/error/ErrorBoundary.js";
import { ProjectRail } from "./components/ProjectRail.js";
import { TopBar } from "./components/TopBar.js";
import { EmptyProject } from "./components/EmptyProject.js";
import { GraphEmpty } from "./components/GraphEmpty.js";
import { PortalCard } from "./components/PortalCard.js";
import { BoundaryPortChip } from "./components/BoundaryPortChip.js";
import { PeekPanel } from "./components/PeekPanel.js";
import { NodeEditor } from "./components/NodeEditor.js";
import { EdgeManager, type EdgeDraft } from "./components/EdgeManager.js";
import { ThreadPanel } from "./components/ThreadPanel.js";

// App composes the four renderer layers and owns nothing but the transient bits
// of the shell: the open dialogs, the prompt box, and the canvas element size.
//   useProjectGraph   the saved document and its writes
//   useAgentSession   provider runs and the events they stream back
//   useCanvasView     camera, selection, unfolded Rooms — never persisted
//   useFlowProjection the read path from document to what is drawn
export function App() {
  const [error, setError] = useState<AppError | null>(null);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [nodeDraft, setNodeDraft] = useState<NodeDraft | null>(null);
  const [edgeManagerOpen, setEdgeManagerOpen] = useState(false);
  const [edgeDraft, setEdgeDraft] = useState<EdgeDraft | null>(null);
  const [frame, setFrame] = useState({ width: 960, height: 700 });
  const canvasRef = useRef<HTMLElement | null>(null);

  const reportError = useCallback((reason: unknown) => {
    console.error("[Insightify Renderer] operation failed", reason);
    setError(toAppError(reason));
  }, []);
  const clearError = useCallback(() => setError(null), []);

  const view = useCanvasView();
  const { reset: resetView, setScope, expandRooms, expandNodes, diveTo } = view;

  const projectStore = useProjectGraph({ onError: reportError });
  const {
    projects,
    project,
    graph,
    graphLoading,
    previewing,
    freshness,
    currentGraph,
    receiveGraph,
    proposeGraph,
    acceptProposal,
    discardProposal,
    editGraph: writeGraph,
    pickProject: promptForProject,
    selectProject: openProject,
  } = projectStore;

  // A proposed layout is not the saved document. Editing while one is on screen
  // would write to whichever of the two happened to be underneath, so the user
  // decides on the proposal first.
  const editGraph = useCallback(
    (update: GraphUpdate) => {
      if (previewing) {
        reportError("Apply or discard the proposed layout before editing the graph.");
        return;
      }
      writeGraph(update);
    },
    [previewing, reportError, writeGraph]
  );

  // A generated graph that arrives for a project the user has left is dropped by
  // the store. Only a brand new graph returns the canvas to the top scope: after
  // an expansion or a relayout the user stays in the Room they were standing in.
  const handleGraphGenerated = useCallback(
    (value: GeneratedFlowGraph, _scopeNodeId: string | null, mode: GenerationMode) => {
      // A relayout is a proposal the user still has to accept; a graph or an
      // expansion is already saved by the time it reaches here.
      if (mode === "layout") return proposeGraph(value);
      const applied = receiveGraph(value);
      if (applied && mode === "graph") setScope(null);
      return applied;
    },
    [proposeGraph, receiveGraph, setScope]
  );

  const session = useAgentSession({
    projectId: project?.id ?? null,
    onGraphGenerated: handleGraphGenerated,
    onError: reportError,
    clearError,
  });
  const {
    providers,
    provider,
    providerKind,
    meta,
    events,
    transcript,
    readingFiles,
    currentReadingFile,
    approvals,
    run,
    busy,
    generatingGraph,
    regeneratingLayout,
    expandingScopeId,
    cancelRun,
    clearEvents,
    generateGraph,
    regenerateLayout,
    respondApproval,
  } = session;

  const {
    activeScopeId,
    visibleNodes,
    directNodes,
    roomEdges,
    boundaryPorts,
    positionedNodes,
    positions,
    roomFrames,
    stage,
    stageZoom,
    lod,
    debugAreas,
    editableEdges,
    previews,
    visualEdges,
    edgeLabels,
    hoveredEdge,
    projected,
    portRail,
    scopePath,
    scopeNode,
    selectedNode,
    peekNode,
  } = useFlowProjection({
    graph,
    scopeId: view.scopeId,
    renderedExpandedScopeIds: view.renderedExpandedScopeIds,
    frame,
    zoom: view.zoom,
    hoveredEdgeKey: view.hoveredEdgeKey,
    selectedNodeId: view.selectedNodeId,
    peekNodeId: view.peekNodeId,
    expandedNodeIds: view.expandedNodeIds,
  });

  const {
    expandedNodeIds,
    expandedScopeIds,
    closingScopeIds,
    renderedExpandedScopeIds,
    selectedNodeId,
    hoveredEdgeKey,
    showDebugAreas,
    dive,
    toggleScopeExpand,
    toggleNodeExpansion,
  } = view;

  const drag = useNodeDrag({
    disabled: busy || previewing,
    canvasRef,
    stage,
    stageZoom,
    roomFrames,
    currentGraph,
    previewEdit: projectStore.previewEdit,
    commitPreview: projectStore.commitPreview,
    onSelect: view.selectNode,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver(([entry]) =>
      setFrame({ width: entry.contentRect.width, height: entry.contentRect.height })
    );
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [project, graph]);

  // Opening a project drops everything that described the previous one: the
  // camera, the selection, the transcript, and any error still on screen.
  const selectProject = useCallback(
    (selected: ProjectSummary) => {
      resetView();
      clearError();
      clearEvents();
      openProject(selected);
    },
    [clearError, clearEvents, openProject, resetView]
  );
  const pickProject = useCallback(() => {
    void promptForProject().then((picked) => {
      if (picked) selectProject(picked);
    });
  }, [promptForProject, selectProject]);

  const expandAllRooms = useCallback(() => {
    if (!graph) return;
    expandRooms(roomsInScope(graph.graph, activeScopeId).map((node) => node.id));
  }, [graph, activeScopeId, expandRooms]);
  const collapseAllRooms = view.collapseRooms;
  const expandAllNodes = useCallback(
    () => expandNodes(visibleNodes.map((node) => node.id)),
    [expandNodes, visibleNodes]
  );
  const collapseAllNodes = view.collapseNodes;

  // Entering a Room that has never been decomposed starts its expansion, so the
  // descent never lands the user on an empty canvas.
  function enterRoom(node: FlowNode) {
    if (busy) return;
    const origin = positions.get(node.id);
    diveTo(DIVE_SCALE_IN, origin?.x ?? 50, origin?.y ?? 50, () => {
      view.enterScope(node.id);
      clearEvents();
      const hasChildren =
        currentGraph()?.graph.nodes.some((child) => child.parentId === node.id) ?? false;
      if (!hasChildren) void generateGraph(node.id);
    });
  }

  function navigateToScope(scopeId: string | null) {
    if (busy) return;
    const ownerId = ancestorWithin(graph, activeScopeId, scopeId);
    const owner = ownerId
      ? graph?.layoutOverrides?.[ownerId] ?? graph?.layout[ownerId]
      : undefined;
    diveTo(DIVE_SCALE_OUT, owner?.x ?? 50, owner?.y ?? 50, () => {
      view.enterScope(scopeId, ownerId);
      clearEvents();
    });
  }

  function handleWheel(event: React.WheelEvent<HTMLElement>) {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      view.zoomBy(-event.deltaY * 0.003);
    }
  }

  function askAiAboutNode(node: FlowNode) {
    view.selectNode(node.id);
    setPrompt(buildNodeQuestionPrompt(node));
  }

  function openEditNode(node: FlowNode) {
    view.selectNode(node.id);
    setNodeDraft(nodeDraftFromNode(node));
  }

  function saveNodeDraft() {
    if (!nodeDraft || !isNodeDraftComplete(nodeDraft)) return;
    editGraph((current) =>
      patchNode(current, nodeDraft.nodeId, nodePatchFromDraft(nodeDraft))
    );
    setNodeDraft(null);
  }

  function deleteNode(nodeId: string) {
    const current = currentGraph();
    const node = current?.graph.nodes.find((item) => item.id === nodeId);
    if (!current || !node || !window.confirm(`Delete \u201c${node.title}\u201d and all nested nodes?`)) return;
    editGraph((value) => removeNodeAndDescendants(value, nodeId));
    setNodeDraft(null);
    view.selectNode(null);
  }

  // Pinning an area is a change to the saved document, so it goes through the
  // same edit path as any other: applied, then written back.
  function toggleAreaLock(lock: { roomId: string | null; areaId: string }) {
    editGraph((current) => toggleLayoutAreaLock(current, lock));
  }

  function startNewEdge() {
    if (visibleNodes.length < 2) {
      reportError("Create at least two nodes in this Room before connecting them.");
      return;
    }
    setEdgeDraft({ index: null, source: visibleNodes[0].id, target: visibleNodes[1].id, label: "" });
  }

  function saveEdgeDraft() {
    if (!edgeDraft || edgeDraft.source === edgeDraft.target) {
      reportError("An edge must connect two different nodes.");
      return;
    }
    editGraph((current) =>
      upsertEdge(
        current,
        { source: edgeDraft.source, target: edgeDraft.target, label: edgeDraft.label.trim() },
        edgeDraft.index
      )
    );
    setEdgeDraft(null);
  }

  function deleteEdge(index: number) {
    editGraph((current) => removeEdgeAt(current, index));
    setEdgeDraft(null);
  }

  function startRun() {
    if (!project) return;
    void session.startRun(
      buildAnchoredPrompt(
        { project, graph, scopePath, node: selectedNode ?? scopeNode },
        prompt
      )
    );
  }

  const onNodePointerDown = drag.onPointerDown;
  const onNodePointerMove = drag.onPointerMove;
  const onNodePointerUp = drag.onPointerUp;

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
            visibleNodesCount={directNodes.length}
            boundaryPortsCount={boundaryPorts.length}
            freshness={freshness}
            lod={lod}
            busy={busy}
            provider={provider}
            providers={providers}
            providerKind={providerKind}
            onNavigateToScope={navigateToScope}
            onRegenerateGraph={() => void generateGraph()}
            onSelectProvider={session.selectProvider}
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
                onGenerate={() => void generateGraph()}
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
                    disabled={busy || previewing || !provider?.installed}
                    onClick={() => void regenerateLayout()}
                    title="Graphはそのまま、配置だけをAIに作り直させる"
                  >
                    {regeneratingLayout ? "◴ Arranging…" : "⇄ Relayout"}
                  </button>
                  <button
                    type="button"
                    className={showDebugAreas ? "active" : ""}
                    onClick={view.toggleDebugAreas}
                    title="再帰的エリアDSLの境界と色を表示/非表示"
                  >
                    🗺️ Areas {showDebugAreas ? "ON" : "OFF"}
                  </button>
                </div>
                {previewing && (
                  <div className="layout-proposal-bar" role="status">
                    <span className="layout-proposal-mark" aria-hidden="true">◇</span>
                    <div className="layout-proposal-text">
                      <strong>Proposed layout</strong>
                      <span>
                        固定したAreaと手動配置はそのままです。採用するまで保存されません。
                      </span>
                    </div>
                    <button type="button" className="ghost-button" onClick={discardProposal}>
                      Discard
                    </button>
                    <button type="button" className="primary-button" onClick={acceptProposal}>
                      Apply layout
                    </button>
                  </div>
                )}
                {(generatingGraph || regeneratingLayout || (expandingScopeId !== null && visibleNodes.length > 0)) && (
                  <div className="canvas-generating-overlay" role="status">
                    <span className="generating-pulse-dot" aria-hidden="true" />
                    <div className="generating-text">
                      <strong>
                        {generatingGraph
                          ? `${meta.label} is analyzing snapshot & regenerating graph…`
                          : regeneratingLayout
                          ? `${meta.label} is recomputing semantic layout arrangement…`
                          : `${meta.label} is decomposing Room…`}
                      </strong>
                      <div className="generating-subtext">
                        {currentReadingFile ? (
                          <span className="generating-file-reading" title={currentReadingFile}>
                            📄 Reading: <code>{currentReadingFile}</code>
                            {readingFiles.length > 1 && <em> ({readingFiles.length} files scanned)</em>}
                          </span>
                        ) : (
                          <span>Read-only · validating locally with structured output</span>
                        )}
                      </div>
                    </div>
                    <button type="button" className="stop-button" onClick={cancelRun}>
                      Stop
                    </button>
                  </div>
                )}
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
                  data-vqa="graph-stage"
                  data-vqa-lod={lod}
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
                    <div className="debug-areas-layer" aria-label="Layout areas">
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
                          {area.planArea ? (
                            <button
                              type="button"
                              className={`debug-area-badge is-lockable${
                                isLayoutAreaLocked(graph, area.planArea) ? " is-locked" : ""
                              }`}
                              style={{ color: area.textColor, borderColor: area.borderColor }}
                              onClick={() => toggleAreaLock(area.planArea!)}
                              title={
                                isLayoutAreaLocked(graph, area.planArea)
                                  ? "固定を解除する（次のRelayoutで並び替えられる）"
                                  : "このAreaの構成を固定し、Relayoutから守る"
                              }
                            >
                              <span aria-hidden="true">
                                {isLayoutAreaLocked(graph, area.planArea) ? "🔒" : "🔓"}
                              </span>{" "}
                              {area.name}
                            </button>
                          ) : (
                            <span
                              className="debug-area-badge"
                              style={{ color: area.textColor, borderColor: area.borderColor }}
                            >
                              {area.name}
                            </span>
                          )}
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
                      data-vqa="room-frame"
                      data-vqa-room-id={frame.roomId}
                      data-vqa-columns={frame.columns}
                      data-vqa-rows={frame.rows}
                      data-vqa-child-count={frame.childCount}
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
                          onMouseEnter={() => edge.bundled && view.hoverEdge(edge.key)}
                          onMouseLeave={() => edge.bundled && view.hoverEdge(null)}
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
                      isScopeExpanded={renderedExpandedScopeIds.has(node.id)}
                      isNestedChild={node.parentId !== activeScopeId}
                      isLeavingScope={
                        node.parentId !== activeScopeId &&
                        closingScopeIds.has(node.parentId ?? "")
                      }
                      showAvatar={shouldShowNodeAvatar(node, visibleNodes)}
                      connections={connectionSides(node.id, roomEdges, boundaryPorts)}
                      onSelect={() => {
                        if (drag.consumeClickSuppression(node.id)) return;
                        view.selectNode(node.id);
                        session.clearEvents();
                        // A click means "show me more of this". For a Room that
                        // is the flow inside it, unfolded in place; for anything
                        // else it is the node's own detail. One gesture, and
                        // what it reveals is decided by what the node is.
                        if (isRoom(node)) toggleScopeExpand(node.id);
                        else toggleNodeExpansion(node.id);
                      }}
                      onPeek={() => view.peekNode(node.id)}
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
                  edgeLabels.map((label) => (
                    <span
                      className={`edge-label${label.bundled ? " bundle-label" : ""}`}
                      data-vqa="edge-label"
                      data-vqa-stage-x={label.x}
                      data-vqa-stage-y={label.y}
                      key={`label-${label.key}`}
                      style={{
                        left: `${projected.x(label.x)}%`,
                        top: `${projected.y(label.y)}%`,
                      }}
                    >
                      {label.text}
                    </span>
                  ))}

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
                    onClick={() => view.zoomBy(-0.25)}
                    type="button"
                  >
                    −
                  </button>
                  <span
                    onClick={() => view.setZoom(1 / (stage.scale || 1))}
                    title="クリックで 100% にリセット"
                    style={{ cursor: "pointer" }}
                  >
                    {Math.round(stageZoom * 100)}% · {lod}
                  </span>
                  <button
                    aria-label="拡大"
                    onClick={() => view.zoomBy(0.25)}
                    type="button"
                  >
                    ＋
                  </button>
                </div>

                {peekNode && (
                  <PeekPanel
                    node={peekNode}
                    graph={graph}
                    onClose={() => view.peekNode(null)}
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
          readingFiles={readingFiles}
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
          onErrorDismiss={clearError}
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
