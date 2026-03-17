import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Command, Folder, Moon, PanelLeftClose, PanelLeftOpen, Plus, Sun } from "lucide-react";
import { ProfileManagerDialog } from "./features/provider/components/ProfileManagerDialog";
import { QuickProfileDialog } from "./features/provider/components/QuickProfileDialog";
import { ProviderSetupDialog } from "./features/provider/components/ProviderSetupDialog";
import { ComposerBar } from "./features/session/components/ComposerBar";
import { ThreadTimeline } from "./features/thread/components/ThreadTimeline";
import { PaneGrid } from "./features/workspace/components/PaneGrid";
import { ProjectSidebar } from "./features/workspace/components/ProjectSidebar";
import { useDashboard } from "./hooks/useDashboard";
import { cn } from "./lib/utils";
import { ClaudeIcon } from "./components/icons/ClaudeIcon";
import { CodexIcon } from "./components/icons/CodexIcon";

function App() {
  const {
    dashboard,
    composerValue,
    setComposerValue,
    isHydrating,
    requestError,
    currentProject,
    activePane,
    activeSession,
    providerSetupPrompt,
    profileEditorIntent,
    openSessionIds,
    openSessionCounts,
    profiles,
    paneProfiles,
    canAddPane,
    canClosePane,
    handleCreateProject,
    handleCreateSessionWithOptions,
    handleDeleteProject,
    handleDeleteSession,
    handleOpenSession,
    handleAddPane,
    handleClosePane,
    handleFocusPane,
    handleTogglePaneSelection,
    handleSelectAllPanes,
    setDraftPaneProvider,
    assignProfileToPane,
    saveProfile,
    deleteProfile,
    testProfile,
    inspectProviderAccount,
    dismissProviderSetupPrompt,
    retryProviderSetupPrompt,
    createSessionWithProfileFromPrompt,
    configureThirdPartyProviderFromPrompt,
    consumeProfileEditorIntent,
    launchProviderLogin,
    startProfileCreation,
    handleSendMessage,
    handleRetryLastMessage,
    retryLastMessageForPane,
    cancelPaneRun,
  } = useDashboard();
  const [profileManagerOpen, setProfileManagerOpen] = useState(false);

  // H1: Collapsible sidebar state (persisted to localStorage)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("sidebar-collapsed") === "true";
    } catch {
      return false;
    }
  });

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("sidebar-collapsed", String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  // L4: Dark mode state (persisted to localStorage)
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return localStorage.getItem("theme") === "dark";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    try {
      localStorage.setItem("theme", darkMode ? "dark" : "light");
    } catch {
      // ignore
    }
  }, [darkMode]);

  // H6: Composer textarea ref for focus shortcut
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  // H6: Global keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;

      // Cmd/Ctrl+1~4 — focus pane by slot
      if (event.key >= "1" && event.key <= "4") {
        event.preventDefault();
        const slotIndex = Number(event.key) - 1;
        const pane = dashboard.workspace.panes[slotIndex];
        if (pane) {
          handleFocusPane(pane.id);
        }
        return;
      }

      // Cmd/Ctrl+N — new session in current project
      if (event.key === "n") {
        event.preventDefault();
        if (currentProject) {
          handleCreateSessionWithOptions(currentProject.id, { provider: "claude", profileId: null });
        }
        return;
      }

      // Cmd/Ctrl+\ — toggle sidebar
      if (event.key === "\\") {
        event.preventDefault();
        toggleSidebar();
        return;
      }

      // Cmd/Ctrl+J — focus composer input
      if (event.key === "j") {
        event.preventDefault();
        composerRef.current?.focus();
        return;
      }

      // Cmd/Ctrl+W — close active pane
      if (event.key === "w") {
        if (canClosePane && activePane) {
          event.preventDefault();
          handleClosePane(activePane.id);
        }
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dashboard.workspace.panes, currentProject, activePane, canClosePane, handleFocusPane, handleCreateSessionWithOptions, handleClosePane, toggleSidebar]);

  const setupProviderState = useMemo(
    () =>
      providerSetupPrompt
        ? dashboard.providers.find((provider) => provider.id === providerSetupPrompt.provider) ?? null
        : null,
    [dashboard.providers, providerSetupPrompt],
  );
  const existingThirdPartyProfiles = useMemo(
    () =>
      providerSetupPrompt
        ? profiles.filter(
          (profile) =>
            profile.provider === providerSetupPrompt.provider && profile.authKind === "apiKey",
        )
        : [],
    [profiles, providerSetupPrompt],
  );
  const activeProfile = activePane ? paneProfiles[activePane.id] ?? null : null;
  const activeProvider = activePane?.provider ?? activeSession?.provider ?? null;
  const activeProviderTypeLabel =
    activeProvider === "codex" ? "Codex" : activeProvider === "claude" ? "Claude Code" : null;
  const activeProviderNameLabel = activeProfile?.label?.trim() || null;
  const activeProviderProfiles = useMemo(() => profiles, [profiles]);

  // H4: Merged provider + profile badge label
  const mergedProviderLabel = useMemo(() => {
    if (!activeProviderTypeLabel) return null;
    if (activeProviderNameLabel) return `${activeProviderTypeLabel} / ${activeProviderNameLabel}`;
    return activeProviderTypeLabel;
  }, [activeProviderTypeLabel, activeProviderNameLabel]);

  // H4: Pane dots
  const paneCount = dashboard.workspace.panes.length;
  const maxPanes = 4;

  // L5: Loading skeleton
  if (isHydrating) {
    return (
      <main className="flex h-screen w-full bg-background text-foreground overflow-hidden font-sans">
        <aside className="w-[280px] flex-shrink-0 bg-sidebar border-r flex flex-col z-20 p-4 space-y-4">
          <div className="h-4 w-16 bg-muted animate-pulse rounded" />
          <div className="space-y-2">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="h-8 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </aside>
        <section className="flex-1 flex flex-col h-full bg-background">
          <div className="h-10 border-b bg-background/80 px-3 flex items-center gap-3">
            <div className="h-5 w-24 bg-muted animate-pulse rounded-full" />
            <div className="h-5 w-40 bg-muted animate-pulse rounded" />
          </div>
          <div className="flex-1 flex flex-col items-center pt-16 px-8 space-y-4">
            <div className="h-4 w-3/4 max-w-lg bg-muted animate-pulse rounded" />
            <div className="h-4 w-1/2 max-w-sm bg-muted animate-pulse rounded" />
            <div className="h-4 w-2/3 max-w-md bg-muted animate-pulse rounded" />
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="flex h-screen w-full bg-background text-foreground overflow-hidden font-sans">
      {/* H1: Collapsible sidebar */}
      <aside
        className={cn(
          "flex-shrink-0 bg-sidebar border-r flex flex-col z-20 transition-[width] duration-200 overflow-hidden",
          sidebarCollapsed ? "w-[52px]" : "w-[280px]",
        )}
      >
        {/* H1: Sidebar toggle button */}
        <div className={cn(
          "flex items-center shrink-0 px-2 pt-3 pb-1",
          sidebarCollapsed ? "justify-center" : "justify-end",
        )}>
          <button
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
            onClick={toggleSidebar}
            title={sidebarCollapsed ? "展开侧边栏 (⌘\\)" : "折叠侧边栏 (⌘\\)"}
            type="button"
          >
            {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>
        <ProjectSidebar
          collapsed={sidebarCollapsed}
          projects={dashboard.projects}
          activeSessionId={activeSession?.id ?? null}
          openSessionIds={openSessionIds}
          openSessionCounts={openSessionCounts}
          onCreateProject={handleCreateProject}
          onCreateSessionWithOptions={handleCreateSessionWithOptions}
          onOpenSession={handleOpenSession}
          onDeleteProject={handleDeleteProject}
          onDeleteSession={handleDeleteSession}
          onOpenGlobalSettings={() => setProfileManagerOpen(true)}
        />
      </aside>

      <section className="flex-1 flex flex-col h-full bg-background relative overflow-hidden">
        {/* Global Error Banner */}
        {requestError && (
          <div className="mx-6 mt-4 p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 shadow-sm flex items-center justify-between">
            <span className="text-sm font-medium">{requestError}</span>
          </div>
        )}

        {/* Main Chat Flow Area - Full Height */}
        <div className="flex-1 flex outline-none overflow-hidden relative justify-center transition-all">
          <div className="flex-1 h-full w-full transition-all duration-300">
            {dashboard.workspace.panes.length > 1 ? (
              <div className="w-full h-full">
                <PaneGrid
                  activePaneId={dashboard.workspace.activePaneId}
                  canAddPane={canAddPane}
                  canClosePane={canClosePane}
                  onAddPane={handleAddPane}
                  panes={dashboard.workspace.panes}
                  paneProfiles={paneProfiles}
                  profiles={profiles}
                  onCancelRun={cancelPaneRun}
                  onClosePane={handleClosePane}
                  onChangeProvider={setDraftPaneProvider}
                  onFocusPane={handleFocusPane}
                  onTogglePaneSelection={handleTogglePaneSelection}
                  selectedPaneIds={dashboard.workspace.selectedPaneIds}
                  onAssignProfile={assignProfileToPane}
                  onRetryLastMessage={retryLastMessageForPane}
                  onCreateProfile={(paneId) => {
                    const pane = dashboard.workspace.panes.find((candidate) => candidate.id === paneId);
                    if (!pane) {
                      return;
                    }
                    startProfileCreation(
                      pane.provider,
                      pane.provider === "codex" ? "official" : "system",
                      pane.id,
                    );
                  }}
                  currentProject={currentProject}
                  darkMode={darkMode}
                  setDarkMode={setDarkMode}
                />
              </div>
            ) : (
              <div className="w-[80%] max-w-[1200px] mx-auto h-full flex flex-col">
                {/* Single pane header with all info */}
                <div className="flex items-center justify-between px-4 py-2 border-b bg-background/80 backdrop-blur-sm shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    {/* Provider badge */}
                    {mergedProviderLabel && (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold shrink-0",
                          activeProvider === "codex"
                            ? "border-sky-200 bg-sky-50 text-sky-700"
                            : "border-amber-200 bg-amber-50 text-amber-700",
                        )}
                      >
                        {activeProvider === "codex" ? <CodexIcon size={12} className="opacity-70" /> : <ClaudeIcon size={12} className="opacity-70" />}
                        {mergedProviderLabel}
                      </span>
                    )}
                    {/* Title */}
                    <h1 className="text-sm font-semibold text-foreground truncate">
                      {activeSession?.title ?? activePane?.title ?? "新对话"}
                    </h1>
                    {/* Project name */}
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
                      <Folder size={11} />
                      {currentProject?.name ?? "No Project"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Add pane button */}
                    <button
                      className="p-1.5 rounded-lg bg-muted hover:bg-muted/80 transition-colors text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={handleAddPane}
                      disabled={!canAddPane}
                      title="分屏打开当前会话"
                    >
                      <Plus size={14} />
                    </button>
                    {/* Dark mode toggle */}
                    <button
                      className="p-1.5 rounded-lg hover:bg-muted/80 transition-colors text-muted-foreground"
                      onClick={() => setDarkMode((prev) => !prev)}
                      title={darkMode ? "切换到浅色模式" : "切换到深色模式"}
                      type="button"
                    >
                      {darkMode ? <Sun size={14} /> : <Moon size={14} />}
                    </button>
                  </div>
                </div>

                {/* Thread content */}
                <div className="flex-1 overflow-hidden">
                  <ThreadTimeline
                    activePane={activePane}
                    activeProfile={activeProfile}
                    availableProfiles={activeProviderProfiles}
                    onChangeProvider={(provider) => {
                      if (!activePane) {
                        return;
                      }
                      setDraftPaneProvider(activePane.id, provider);
                    }}
                    onAssignProfile={(profileId) => {
                      if (!activePane) {
                        return;
                      }
                      assignProfileToPane(activePane.id, profileId);
                    }}
                    onCreateProfile={() => {
                      if (!activePane) {
                        return;
                      }
                      startProfileCreation(
                        activePane.provider,
                        activePane.provider === "codex" ? "official" : "system",
                        activePane.id,
                      );
                    }}
                    onRetryLastMessage={handleRetryLastMessage}
                    onSuggest={(text) => setComposerValue(text)}
                    fullWidth={false}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Floating Absolute Composer Area */}
          <div className={cn(
            "absolute bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all pointer-events-none",
            dashboard.workspace.panes.length === 1 ? "w-[80%] max-w-[1000px]" : "w-[90%] max-w-[1200px]"
          )}>
            <div className="pointer-events-auto">
              <ComposerBar
                provider={activePane?.provider ?? null}
                value={composerValue}
                onChange={setComposerValue}
                onSend={handleSendMessage}
                paneCount={paneCount}
                selectedPaneIds={dashboard.workspace.selectedPaneIds}
                activePaneId={dashboard.workspace.activePaneId}
                onSelectAllPanes={handleSelectAllPanes}
                composerRef={composerRef}
              />
            </div>
          </div>
        </div>
      </section>

      {providerSetupPrompt && (
        <ProviderSetupDialog
          existingProfiles={existingThirdPartyProfiles}
          onClose={dismissProviderSetupPrompt}
          onConfigureThirdParty={configureThirdPartyProviderFromPrompt}
          onLaunchOfficialLogin={launchProviderLogin}
          onRetry={retryProviderSetupPrompt}
          onUseProfile={createSessionWithProfileFromPrompt}
          prompt={providerSetupPrompt}
          providerState={setupProviderState}
        />
      )}

      {profileEditorIntent && !profileManagerOpen && (
        <QuickProfileDialog
          onClose={consumeProfileEditorIntent}
          onInspectProviderAccount={inspectProviderAccount}
          onSave={saveProfile}
          onTest={testProfile}
          provider={profileEditorIntent.provider}
        />
      )}

      {profileManagerOpen && (
        <ProfileManagerDialog
          editorIntent={profileEditorIntent}
          onClose={() => {
            consumeProfileEditorIntent();
            setProfileManagerOpen(false);
          }}
          onConsumeEditorIntent={consumeProfileEditorIntent}
          onDeleteProfile={deleteProfile}
          onInspectProviderAccount={inspectProviderAccount}
          onSaveProfile={saveProfile}
          onTestProfile={testProfile}
          profiles={profiles}
          providers={dashboard.providers}
        />
      )}
    </main>
  );
}

export default App;
