import React, { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error inside ErrorBoundary:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="fatal-error-view">
          <div className="fatal-error-icon">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" width="32" height="32" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1>予期しないエラーが発生しました</h1>
          <p>
            {this.state.error?.message || "コンポーネントの描画中に問題が発生しました。"}
          </p>
          <div className="fatal-error-actions">
            <button className="primary-button" type="button" onClick={this.handleReset}>
              再読み込み
            </button>
            <button
              className="quiet-button"
              type="button"
              onClick={() => window.location.reload()}
            >
              画面全体をリロード
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
