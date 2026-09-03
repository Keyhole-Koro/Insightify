import { useCallback, useEffect, useRef, useState } from "react";
import type { GraphFreshness, ProjectSummary } from "@insightify/desktop-bridge";
import type { GeneratedFlowGraph } from "@insightify/graph-domain";
import { useBridge } from "../lib/bridge.js";

type ProjectGraphOptions = {
  onError: (reason: unknown) => void;
};

export type GraphUpdate = (current: GeneratedFlowGraph) => GeneratedFlowGraph;

export type ProjectGraphStore = {
  projects: ProjectSummary[];
  project: ProjectSummary | null;
  /** The saved document, or the proposal while one is being previewed. */
  graph: GeneratedFlowGraph | null;
  graphLoading: boolean;
  /** True while a generated layout is on screen but not yet accepted. */
  previewing: boolean;
  /** Whether the saved graph still describes the project it was generated from. */
  freshness: GraphFreshness["state"];
  /** Reads the newest graph synchronously, for pointer handlers that cannot wait for a render. */
  currentGraph: () => GeneratedFlowGraph | null;
  /** Opens the picker and registers the choice. Returns null when cancelled. */
  pickProject: () => Promise<ProjectSummary | null>;
  selectProject: (selected: ProjectSummary) => void;
  /** Accepts a generated graph, ignoring one that arrives for a project the user has left. */
  receiveGraph: (value: GeneratedFlowGraph) => boolean;
  /** Shows a generated document without saving it. */
  proposeGraph: (value: GeneratedFlowGraph) => boolean;
  /** Writes the proposal to disk. */
  acceptProposal: () => void;
  /** Drops the proposal and returns to the saved document. */
  discardProposal: () => void;
  /** Applies an edit and writes it back to disk. */
  editGraph: (update: GraphUpdate) => void;
  /** Applies an edit without saving — for the frames of a drag. */
  previewEdit: (update: GraphUpdate) => void;
  /** Saves whatever previewEdit left in memory — for the end of a drag. */
  commitPreview: () => void;
};

export function useProjectGraph(options: ProjectGraphOptions): ProjectGraphStore {
  const bridge = useBridge();
  const { onError } = options;
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [graph, setGraphState] = useState<GeneratedFlowGraph | null>(null);
  // A proposal is never written to graphRef: edits and drags keep working
  // against the saved document, and accepting is the only way to replace it.
  const [proposal, setProposal] = useState<GeneratedFlowGraph | null>(null);
  const [graphLoading, setGraphLoading] = useState(false);
  const [freshness, setFreshness] = useState<GraphFreshness["state"]>("unknown");
  const projectIdRef = useRef<string | null>(null);
  const graphRef = useRef<GeneratedFlowGraph | null>(null);
  // Saves are serialized: a drag can outrun a write, and the last position must win.
  const saveQueue = useRef(Promise.resolve());

  const setGraph = useCallback((value: GeneratedFlowGraph | null) => {
    graphRef.current = value;
    setGraphState(value);
    setProposal(null);
  }, []);

  // Answering this means hashing the whole project, so it runs once per load
  // rather than on every render, and a failure here must never surface as an
  // error over the graph the user can already see.
  const refreshFreshness = useCallback(
    (projectId: string) => {
      setFreshness("unknown");
      void bridge
        .checkGraphFreshness(projectId)
        .then((result) => {
          if (projectIdRef.current === projectId) setFreshness(result.state);
        })
        .catch(() => setFreshness("unknown"));
    },
    [bridge]
  );

  const loadGraph = useCallback(
    async (projectId: string) => {
      setGraphLoading(true);
      try {
        const value = await bridge.getProjectGraph(projectId);
        if (projectIdRef.current !== projectId) return;
        setGraph(value);
        if (value) refreshFreshness(projectId);
      } catch (reason) {
        onError(reason);
      } finally {
        if (projectIdRef.current === projectId) setGraphLoading(false);
      }
    },
    [bridge, onError, refreshFreshness, setGraph]
  );

  useEffect(() => {
    void bridge
      .listProjects()
      .then((knownProjects) => {
        setProjects(knownProjects);
        const initial = knownProjects[0] ?? null;
        setProject(initial);
        projectIdRef.current = initial?.id ?? null;
        if (initial) void loadGraph(initial.id);
      })
      .catch(onError);
  }, [bridge, loadGraph, onError]);

  const selectProject = useCallback(
    (selected: ProjectSummary) => {
      projectIdRef.current = selected.id;
      setProject(selected);
      setGraph(null);
      void loadGraph(selected.id);
    },
    [loadGraph, setGraph]
  );

  const pickProject = useCallback(async () => {
    try {
      const selected = await bridge.pickProject();
      if (!selected) return null;
      setProjects((current) => [selected, ...current.filter((item) => item.id !== selected.id)]);
      return selected;
    } catch (reason) {
      onError(reason);
      return null;
    }
  }, [bridge, onError]);

  const persistGraph = useCallback(
    (value: GeneratedFlowGraph) => {
      setGraph(value);
      saveQueue.current = saveQueue.current
        .then(async () => {
          await bridge.saveProjectGraph(value);
        })
        .catch(onError);
    },
    [bridge, onError, setGraph]
  );

  const receiveGraph = useCallback(
    (value: GeneratedFlowGraph) => {
      if (value.projectId !== projectIdRef.current) return false;
      setGraph(value);
      // A graph that has just been generated was hashed from the snapshot it
      // was generated from, so it is fresh without asking.
      setFreshness("fresh");
      return true;
    },
    [setGraph]
  );

  const proposeGraph = useCallback((value: GeneratedFlowGraph) => {
    if (value.projectId !== projectIdRef.current) return false;
    setProposal(value);
    return true;
  }, []);

  const acceptProposal = useCallback(() => {
    if (proposal) persistGraph(proposal);
  }, [persistGraph, proposal]);

  const discardProposal = useCallback(() => setProposal(null), []);

  const editGraph = useCallback(
    (update: GraphUpdate) => {
      const current = graphRef.current;
      if (current) persistGraph(update(current));
    },
    [persistGraph]
  );

  const previewEdit = useCallback(
    (update: GraphUpdate) => {
      const current = graphRef.current;
      if (current) setGraph(update(current));
    },
    [setGraph]
  );

  const commitPreview = useCallback(() => {
    if (graphRef.current) persistGraph(graphRef.current);
  }, [persistGraph]);

  return {
    projects,
    project,
    graph: proposal ?? graph,
    graphLoading,
    previewing: proposal !== null,
    freshness,
    currentGraph: () => graphRef.current,
    pickProject,
    selectProject,
    receiveGraph,
    proposeGraph,
    acceptProposal,
    discardProposal,
    editGraph,
    previewEdit,
    commitPreview,
  };
}
