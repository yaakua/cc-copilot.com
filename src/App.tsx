import { ComposerBar } from "./features/session/components/ComposerBar";
import { ProfileSettingsPanel } from "./features/provider/components/ProfileSettingsPanel";
import { ThreadTimeline } from "./features/thread/components/ThreadTimeline";
import { ProviderRail } from "./features/provider/components/ProviderRail";
import { RemotePanel } from "./features/remote/components/RemotePanel";
import { PaneGrid } from "./features/workspace/components/PaneGrid";
import { ProjectSidebar } from "./features/workspace/components/ProjectSidebar";
import { useDashboard } from "./hooks/useDashboard";

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
    profiles,
    paneProfiles,
    canAddPane,
    canClosePane,
    threadStats,
    handleCreateProject,
    handleCreateSession,
    handleCreateSessionWithOptions,
    handleOpenSession,
    handleAddPane,
    handleAddPaneWithOptions,
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
    <main className="desktop-shell">
      <ProjectSidebar
        currentProjectId={dashboard.workspace.projectId}
        projects={dashboard.projects}
        profiles={profiles}
        onCreateProject={handleCreateProject}
        onCreateSession={handleCreateSession}
        onCreateSessionWithOptions={handleCreateSessionWithOptions}
        onOpenSession={handleOpenSession}
      />

      <section className="content-shell">
        <header className="content-toolbar">
          <div className="content-toolbar-left">
            <h1>
              {activeSession?.title ?? "Rebuild Tarui UI for Claude CLI"}
              <span>{currentProject?.name ?? "cc-copilot-next"}</span>
            </h1>
          </div>

          <div className="content-toolbar-right">
            <button className="toolbar-button" type="button">
              打开
            </button>
            <button className="toolbar-button" type="button">
              提交
            </button>
            <span className="toolbar-metric">
              +{threadStats.positive} -{threadStats.negative}
            </span>
          </div>
        </header>

        <PaneGrid
          activePaneId={dashboard.workspace.activePaneId}
          canAddPane={canAddPane}
          canClosePane={canClosePane}
          currentProject={currentProject}
          onAddPane={handleAddPane}
          onAddPaneWithOptions={handleAddPaneWithOptions}
          onCancelRun={cancelPaneRun}
          panes={dashboard.workspace.panes}
          paneProfiles={paneProfiles}
          profiles={profiles}
          selectedPaneIds={dashboard.workspace.selectedPaneIds}
          onClosePane={handleClosePane}
          onFocusPane={handleFocusPane}
          onTogglePaneSelection={handleTogglePaneSelection}
          onAssignProfile={assignProfileToPane}
        />

        <section className="dashboard-status-grid" aria-label="Dashboard status">
          <RemotePanel onToggle={handleToggleRemote} remote={dashboard.remote} />
          <div className="dashboard-settings-column">
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
        </section>

        {requestError ? <div className="notice-banner">{requestError}</div> : null}

        <ThreadTimeline
          activePane={activePane}
          activeSession={activeSession}
          isHydrating={isHydrating}
          projectName={currentProject?.name ?? "workspace"}
          threadStats={threadStats}
        />

        <ComposerBar
          activePane={activePane}
          paneCount={dashboard.workspace.panes.length}
          selectedPaneCount={dashboard.workspace.selectedPaneIds.length}
          value={composerValue}
          onChange={setComposerValue}
          onSend={handleSendMessage}
        />
      </section>
    </main>
  );
}

export default App;
