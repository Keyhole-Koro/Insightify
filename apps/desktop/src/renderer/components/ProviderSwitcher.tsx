import React from "react";
import type { ProviderInstallation } from "@insightify/agent-runtime";
import type { ExecutableAgentProvider } from "@insightify/desktop-bridge";
import { providerKinds, providerMeta } from "../lib/constants.js";

interface ProviderSwitcherProps {
  providers: ProviderInstallation[];
  selected: ExecutableAgentProvider;
  busy: boolean;
  onSelect: (kind: ExecutableAgentProvider) => void;
}

export function ProviderSwitcher({
  providers,
  selected,
  busy,
  onSelect,
}: ProviderSwitcherProps) {
  return (
    <div className="provider-switcher" aria-label="Agent provider">
      {providerKinds.map((kind) => {
        const installation = providers.find((item) => item.provider === kind);
        const meta = providerMeta[kind];
        return (
          <button
            className={`${selected === kind ? "provider-option selected" : "provider-option"} ${
              installation?.installed ? "online" : "offline"
            }`}
            disabled={busy || !installation?.installed}
            key={kind}
            onClick={() => onSelect(kind)}
            title={
              installation?.installed
                ? installation.version ?? meta.label
                : `${meta.label} CLI not detected`
            }
            type="button"
          >
            <b>{meta.shortLabel}</b>
            <span>{meta.label}</span>
            <i />
          </button>
        );
      })}
    </div>
  );
}
