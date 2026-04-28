import type { ReactNode } from "react";
import { Component } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageSectionCard } from "@/components/shared/PageSectionCard";

type ErrorBoundaryProps = {
  children: ReactNode;
  title?: string;
  description?: string;
};

type ErrorBoundaryState = {
  hasError: boolean;
  message: string | null;
};

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: null,
  };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : "Unknown UI error",
    };
  }

  componentDidCatch(error: unknown, errorInfo: unknown) {
    console.error("ErrorBoundary caught a render error", error, errorInfo);
  }

  render() {
    const {
      children,
      title = "Pipeline panel recovered",
      description = "A panel crashed during render. Reload or continue with other tabs.",
    } = this.props;

    if (!this.state.hasError) {
      return children;
    }

    return (
      <PageSectionCard eyebrow="Fallback" title={title}>
        <EmptyState title={description} />
        {this.state.message ? (
          <div className="mt-4 rounded-[20px] console-surface-dashed px-4 py-3 text-sm text-muted-foreground">
            {this.state.message}
          </div>
        ) : null}
      </PageSectionCard>
    );
  }
}
