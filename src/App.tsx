import { useState } from "react";
import { Settings, Plus } from "lucide-react";
import { ComposerBar } from "./features/session/components/ComposerBar";
import { ProfileSettingsPanel } from "./features/provider/components/ProfileSettingsPanel";
import { ThreadTimeline } from "./features/thread/components/ThreadTimeline";
import { ProviderRail } from "./features/provider/components/ProviderRail";
import { RemotePanel } from "./features/remote/components/RemotePanel";
import { PaneGrid } from "./features/workspace/components/PaneGrid";
import { ProjectSidebar } from "./features/workspace/components/ProjectSidebar";
import { useDashboard } from "./hooks/useDashboard";
import { cn } from "./lib/utils";

function App() {
  const [showSettings, setShowSettings] = useState(false);

  const {
    dashboard,
    composerValue,
    setComposerValue,
    requestError,
    currentProject,
    activePane,
    activeSession,
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
    assignProfileToPane,
    saveProfile,
    deleteProfile,
    testProfile,
    launchProviderLogin,
    handleToggleRemote,
    handleSendMessage,
    cancelPaneRun,
  } = useDashboard();

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
            <h1 className="text-[13px] font-semibold text-foreground m-0">
              {activeSession?.title ?? "Claude Copilot"}
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
            <button
              className={cn("p-1 rounded-full hover:bg-muted transition-colors text-muted-foreground", showSettings && "bg-muted text-foreground")}
              onClick={() => setShowSettings(!showSettings)}
              title="设置"
            >
              <Settings size={15} />
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
          <div className={cn(
            "flex-1 h-full pb-2 transition-all duration-300",
            showSettings ? "hidden lg:block lg:w-2/3 xl:w-3/4" : "w-full"
          )}>
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
                />
              </div>
            )}
          </div>

          {/* Collapsible Settings Side Panel */}
          {showSettings && (
            <aside className="w-full lg:w-1/3 xl:w-1/4 h-full border-l bg-background overflow-y-auto flex flex-col absolute lg:relative right-0 z-10 shadow-xl lg:shadow-none">
              <div className="p-5 flex flex-col gap-6">
                <div className="flex items-center justify-between pb-4 border-b">
                  <h3 className="font-semibold text-sm">环境与提供商设置</h3>
                </div>
                <RemotePanel onToggle={handleToggleRemote} remote={dashboard.remote} />
                <ProviderRail providers={dashboard.providers} />
                <ProfileSettingsPanel
                  activePaneId={dashboard.workspace.activePaneId}
                  onDeleteProfile={deleteProfile}
                  onLaunchProviderLogin={launchProviderLogin}
                  onSaveProfile={saveProfile}
                  onTestProfile={testProfile}
                  profiles={profiles}
                  providers={dashboard.providers}
                />
              </div>
            </aside>
          )}

          {/* Floating Absolute Composer Area */}
          <div className={cn(
            "absolute bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all pointer-events-none",
            dashboard.workspace.panes.length === 1 ? "w-[80%] max-w-[1000px]" : "w-[90%] max-w-[1200px]"
          )}>
            <div className="pointer-events-auto">
              <ComposerBar
                value={composerValue}
                onChange={setComposerValue}
                onSend={handleSendMessage}
              />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default App;
