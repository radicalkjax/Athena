import { Component } from "solid-js";

interface CodeEditorProps {
  content: string;
  language?: string;
  className?: string;
}

const CodeEditor: Component<CodeEditorProps> = (props) => {
  return (
    <div class={`code-editor ${props.className || ''}`}>
      <div class="code-content">
        <pre>{props.content}</pre>
      </div>
    </div>
  );
};

export default CodeEditor;