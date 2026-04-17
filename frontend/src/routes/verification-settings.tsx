import React from "react";
import { OrgWideSettingsBadge } from "#/components/features/settings/org-wide-settings-badge";
import { SdkSectionPage } from "#/components/features/settings/sdk-settings/sdk-section-page";
import { SettingsScope } from "#/types/settings";
import { createPermissionGuard } from "#/utils/org/permission-guard";

function VerificationSettingsHeader({
  scope,
  renderTopContent,
}: {
  scope: SettingsScope;
  renderTopContent?: () => React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      {renderTopContent?.()}
      {scope === "org" ? <OrgWideSettingsBadge /> : null}
    </div>
  );
}

export function VerificationSettingsScreen({
  scope = "personal",
  renderTopContent,
  testId = "verification-settings-screen",
}: {
  scope?: SettingsScope;
  renderTopContent?: () => React.ReactNode;
  testId?: string;
}) {
  const buildHeader = React.useCallback(
    () => (
      <VerificationSettingsHeader
        scope={scope}
        renderTopContent={renderTopContent}
      />
    ),
    [scope, renderTopContent],
  );

  return (
    <SdkSectionPage
      scope={scope}
      settingsSource="conversation_settings"
      sectionKeys={["verification"]}
      header={buildHeader}
      testId={testId}
    />
  );
}

export const clientLoader = createPermissionGuard("view_llm_settings");

export default VerificationSettingsScreen;
