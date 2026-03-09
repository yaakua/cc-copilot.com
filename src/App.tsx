import { useMemo } from "react";
import { Bot, Command, Plus } from "lucide-react";
import { QuickProfileDialog } from "./features/provider/components/QuickProfileDialog";
import { ProviderSetupDialog } from "./features/provider/components/ProviderSetupDialog";
import { ComposerBar } from "./features/session/components/ComposerBar";
import { ThreadTimeline } from "./features/thread/components/ThreadTimeline";
import { PaneGrid } from "./features/workspace/components/PaneGrid";
import { ProjectSidebar } from "./features/workspace/components/ProjectSidebar";
import { useDashboard } from "./hooks/useDashboard";
import { cn } from "./lib/utils";

function App() {
  const {
    dashboard,
    composerValue,
    setComposerValue,
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
    setDraftPaneProvider,
    assignProfileToPane,
    saveProfile,
    testProfile,
    dismissProviderSetupPrompt,
    retryProviderSetupPrompt,
    createSessionWithProfileFromPrompt,
    configureThirdPartyProviderFromPrompt,
    consumeProfileEditorIntent,
    launchProviderLogin,
    startProfileCreation,
    handleSendMessage,
    handleRetryLastMessage,
    cancelPaneRun,
  } = useDashboard();

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
  const activeProviderProfiles = useMemo(
    () =>
      activePane
        ? profiles.filter((profile) => profile.provider === activePane.provider)
        : [],
    [activePane, profiles],
  );

  return (
    <main className="flex h-screen w-full bg-background text-foreground overflow-hidden font-sans">
      <aside className="w-[300px] flex-shrink-0 bg-sidebar border-r flex flex-col z-20">
        <ProjectSidebar
          currentProjectId={dashboard.workspace.projectId}
          projects={dashboard.projects}
          activeSessionId={activeSession?.id ?? null}
          openSessionIds={openSessionIds}
          openSessionCounts={openSessionCounts}
          onCreateProject={handleCreateProject}
          onCreateSessionWithOptions={handleCreateSessionWithOptions}
          onOpenSession={handleOpenSession}
          onDeleteProject={handleDeleteProject}
          onDeleteSession={handleDeleteSession}
        />
      </aside>

      <section className="flex-1 flex flex-col h-full bg-background relative overflow-hidden">
        {/* Top Header */}
        <header className="flex items-center justify-between px-3 py-1.5 border-b bg-background/80 backdrop-blur-md z-10 sticky top-0 shadow-sm">
          <div className="flex items-center space-x-2">
            {activeProvider && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                  activeProvider === "codex"
                    ? "border-sky-200 bg-sky-50 text-sky-700"
                    : "border-amber-200 bg-amber-50 text-amber-700",
                )}
              >
                {activeProvider === "codex" ? <Command size={12} /> : <Bot size={12} />}
                {activeProvider === "codex" ? "Codex" : "Claude Code"}
              </span>
            )}
            <h1 className="text-[13px] font-semibold text-foreground m-0">
              {activeSession?.title ?? activePane?.title ?? "Claude Copilot"}
            </h1>
            <span className="text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {currentProject?.name ?? "No Project"}
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">
              已打开 {dashboard.workspace.panes.length}/4
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="p-1 rounded-full hover:bg-muted transition-colors text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleAddPane}
              disabled={!canAddPane}
              title="分屏打开当前会话"
            >
              <Plus size={15} />
            </button>
          </div>
        </header>

        {/* Global Error Banner */}
        {requestError && (
          <div className="mx-6 mt-4 p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 shadow-sm flex items-center justify-between">
            <span className="text-sm font-medium">{requestError}</span>
          </div>
        )}

        {/* Main Chat Flow Area */}
        <div className="flex-1 flex outline-none overflow-hidden relative justify-center transition-all">
          <div className="flex-1 h-full w-full pb-2 transition-all duration-300">
            {dashboard.workspace.panes.length > 1 ? (
              <div className="w-full h-full pb-28">
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
                  onFocusPane={handleFocusPane}
                  onTogglePaneSelection={handleTogglePaneSelection}
                  selectedPaneIds={dashboard.workspace.selectedPaneIds}
                  onAssignProfile={assignProfileToPane}
                />
              </div>
            ) : (
              <div className="w-[80%] max-w-[1200px] mx-auto h-full pb-28">
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
                />
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

      {profileEditorIntent && (
        <QuickProfileDialog
          onClose={consumeProfileEditorIntent}
          onSave={saveProfile}
          onTest={testProfile}
          provider={profileEditorIntent.provider}
        />
      )}
    </main>
  );
}

export default App;
