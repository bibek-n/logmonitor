"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

// Isolates rendering failures inside the canvas/panel tree (e.g. a malformed node payload)
// so one bad diagram can't blank out the whole designer page.
export class DiagramErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: "0.75rem", height: "100%", padding: "2rem", textAlign: "center",
          }}
        >
          <AlertTriangle size={32} style={{ color: "var(--danger)" }} />
          <p style={{ color: "var(--ink)", fontSize: "0.9rem", maxWidth: 360 }}>
            Something went wrong rendering this diagram. Your saved data has not been changed.
          </p>
          <Button size="sm" variant="secondary" onClick={() => this.setState({ hasError: false })}>
            Try again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
