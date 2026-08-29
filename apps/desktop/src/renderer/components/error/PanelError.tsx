import React from "react";
import { type AppError } from "../../lib/errors.js";

interface PanelErrorProps {
  error: AppError | string | null;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function PanelError({ error, onRetry, onDismiss, className = "" }: PanelErrorProps) {
  if (!error) return null;

  const isObj = typeof error === "object" && error !== null;
  const message = isObj ? error.message : error;
  const kind = isObj && "kind" in error ? error.kind : "unknown";
  const retryable = isObj && "retryable" in error ? error.retryable : false;

  const titles: Record<string, string> = {
    provider: "AI プロバイダー エラー",
    project: "プロジェクト エラー",
    graph: "FlowGraph 生成エラー",
    validation: "入力エラー",
    ipc: "プロセス間通信エラー",
    network: "ネットワーク エラー",
    unknown: "エラーが発生しました",
  };

  return (
    <div className={`panel-error-card ${className}`} role="alert">
      <div className="panel-error-header">
        <svg
          className="error-icon"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          width="16"
          height="16"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <strong>{titles[kind] ?? titles.unknown}</strong>
      </div>
      <p className="panel-error-message">{message}</p>
      {(retryable && onRetry || onDismiss) && (
        <div className="panel-error-actions">
          {retryable && onRetry && (
            <button className="retry-button" type="button" onClick={onRetry}>
              再試行
            </button>
          )}
          {onDismiss && (
            <button className="dismiss-button" type="button" onClick={onDismiss}>
              閉じる
            </button>
          )}
        </div>
      )}
    </div>
  );
}
