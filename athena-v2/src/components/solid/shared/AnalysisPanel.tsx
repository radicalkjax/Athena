import { Component, JSX } from "solid-js";

interface AnalysisPanelProps {
  title: string;
  icon: string;
  children: JSX.Element;
  actions?: JSX.Element;
  className?: string;
  style?: string;
}

const AnalysisPanel: Component<AnalysisPanelProps> = (props) => {
  return (
    <div class={`analysis-panel ${props.className || ''}`} style={props.style}>
      <div class="panel-header">
        <h3 class="panel-title">
          <span>{props.icon}</span> {props.title}
        </h3>
        {props.actions && <div class="panel-actions">{props.actions}</div>}
      </div>
      <div class="panel-content">
        {props.children}
      </div>
    </div>
  );
};

export default AnalysisPanel;