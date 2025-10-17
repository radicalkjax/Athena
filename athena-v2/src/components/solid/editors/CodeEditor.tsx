import { Component, createSignal, onMount, onCleanup, createEffect } from 'solid-js';
import './CodeEditor.css';

interface CodeEditorProps {
  code: string;
  language?: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
  theme?: 'dark' | 'light';
}

const CodeEditor: Component<CodeEditorProps> = (props) => {
  const [highlightedCode, setHighlightedCode] = createSignal('');
  const [lineNumbers, setLineNumbers] = createSignal<number[]>([]);
  const [cursorPosition, setCursorPosition] = createSignal({ line: 1, column: 1 });
  
  let editorRef: HTMLTextAreaElement | undefined;
  let preRef: HTMLPreElement | undefined;

  const syntaxPatterns = {
    keyword: /\b(function|const|let|var|if|else|return|for|while|class|interface|export|import|async|await|try|catch|throw|new|this|super)\b/g,
    string: /(["'`])(?:(?=(\\?))\2.)*?\1/g,
    comment: /(\/\/.*$)|(\/\*[\s\S]*?\*\/)/gm,
    number: /\b\d+(\.\d+)?\b/g,
    operator: /[+\-*/%=<>!&|^~?:]+/g,
    function: /\b[a-zA-Z_]\w*(?=\s*\()/g,
    type: /\b(string|number|boolean|void|any|unknown|never|object|Array|Promise)\b/g,
  };

  const highlightSyntax = (code: string) => {
    let highlighted = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Apply syntax highlighting
    Object.entries(syntaxPatterns).forEach(([className, pattern]) => {
      highlighted = highlighted.replace(pattern, (match) => {
        return `<span class="token ${className}">${match}</span>`;
      });
    });

    return highlighted;
  };

  const updateLineNumbers = (code: string) => {
    const lines = code.split('\n').length;
    setLineNumbers(Array.from({ length: lines }, (_, i) => i + 1));
  };

  const handleInput = (e: InputEvent) => {
    const target = e.target as HTMLTextAreaElement;
    const value = target.value;
    
    props.onChange?.(value);
    updateLineNumbers(value);
    setHighlightedCode(highlightSyntax(value));
    
    // Update cursor position
    const lines = value.substring(0, target.selectionStart).split('\n');
    const lastLine = lines[lines.length - 1];
    setCursorPosition({
      line: lines.length,
      column: (lastLine !== undefined ? lastLine.length : 0) + 1
    });
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLTextAreaElement;
    
    // Handle tab key
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const value = target.value;
      
      target.value = value.substring(0, start) + '  ' + value.substring(end);
      target.selectionStart = target.selectionEnd = start + 2;
      
      handleInput(new InputEvent('input'));
    }
    
    // Handle auto-closing brackets
    const pairs: Record<string, string> = {
      '(': ')',
      '[': ']',
      '{': '}',
      '"': '"',
      "'": "'",
      '`': '`'
    };
    
    if (pairs[e.key] && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const value = target.value;
      
      target.value = value.substring(0, start) + e.key + pairs[e.key] + value.substring(end);
      target.selectionStart = target.selectionEnd = start + 1;
      
      handleInput(new InputEvent('input'));
    }
  };

  const syncScroll = () => {
    if (editorRef && preRef) {
      preRef.scrollTop = editorRef.scrollTop;
      preRef.scrollLeft = editorRef.scrollLeft;
    }
  };

  createEffect(() => {
    const code = props.code || '';
    updateLineNumbers(code);
    setHighlightedCode(highlightSyntax(code));
  });

  onMount(() => {
    if (editorRef) {
      editorRef.addEventListener('scroll', syncScroll);
    }
  });

  onCleanup(() => {
    if (editorRef) {
      editorRef.removeEventListener('scroll', syncScroll);
    }
  });

  return (
    <div class={`code-editor ${props.theme || 'dark'}`}>
      <div class="editor-header">
        <div class="editor-info">
          <span class="language-badge">{props.language || 'JavaScript'}</span>
          <span class="cursor-position">
            Ln {cursorPosition().line}, Col {cursorPosition().column}
          </span>
        </div>
      </div>
      
      <div class="editor-container">
        <div class="line-numbers">
          {lineNumbers().map(num => (
            <div class="line-number">{num}</div>
          ))}
        </div>
        
        <div class="editor-wrapper">
          <pre 
            ref={preRef}
            class="highlighted-code"
            innerHTML={highlightedCode()}
          />
          
          <textarea
            ref={editorRef}
            class="editor-textarea"
            value={props.code}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            readOnly={props.readOnly}
            spellcheck={false}
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
          />
        </div>
      </div>
    </div>
  );
};

export default CodeEditor;