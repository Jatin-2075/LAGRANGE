import { Component, type ErrorInfo, type ReactNode } from "react";
import { Banner } from "./Banner";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  failed: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("UI error caught by boundary:", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div style={{ padding: 16 }}>
        <Banner tone="error" title={this.props.fallbackTitle ?? "Something went wrong"}>
          Reload the page to try again.
        </Banner>
      </div>
    );
  }
}
