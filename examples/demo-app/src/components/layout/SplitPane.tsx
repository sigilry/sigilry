import React from "react";

interface SplitPaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
}

const containerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "row",
  height: "100vh",
  width: "100%",
};

const paneStyle: React.CSSProperties = {
  flex: 1,
  overflow: "auto",
};

const dividerStyle: React.CSSProperties = {
  width: "1px",
  backgroundColor: "#e0e0e0",
  flexShrink: 0,
};

export const SplitPane = ({ left, right }: SplitPaneProps) => (
  <>
    <style>
      {`
        @media (max-width: 768px) {
          .split-pane-container {
            flex-direction: column !important;
          }
          .split-pane-divider {
            width: 100% !important;
            height: 1px !important;
          }
        }
      `}
    </style>
    <div className="split-pane-container" style={containerStyle}>
      <div className="pane" style={paneStyle}>
        {left}
      </div>
      <div className="split-pane-divider" style={dividerStyle} />
      <div className="pane" style={paneStyle}>
        {right}
      </div>
    </div>
  </>
);
