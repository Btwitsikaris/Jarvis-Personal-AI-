import { Component, type ErrorInfo, type ReactNode } from "react";

type State = { failed: boolean };

/** Catches render errors so a bad message or corrupted saved data can't leave a blank screen. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Jarvis UI error:", error, info.componentStack);
  }

  private resetData = () => {
    try {
      localStorage.removeItem("jarvis-chats");
      localStorage.removeItem("jarvis-active-chat");
    } catch {}
    window.location.reload();
  };

  render() {
    if (!this.state.failed) return this.props.children;
    const btn = { padding: "10px 16px", borderRadius: 10, border: "1px solid #333", background: "#111", color: "#fff", cursor: "pointer" } as const;
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#000", color: "#fff", fontFamily: "system-ui, sans-serif", padding: 24, textAlign: "center" }}>
        <div>
          <h2 style={{ margin: "0 0 8px" }}>Something went wrong</h2>
          <p style={{ color: "#aaa", margin: "0 0 20px" }}>Jarvis hit an unexpected error. Reloading usually fixes it.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button style={btn} onClick={() => window.location.reload()}>Reload</button>
            <button style={btn} onClick={this.resetData}>Reset saved chats</button>
          </div>
        </div>
      </div>
    );
  }
}
