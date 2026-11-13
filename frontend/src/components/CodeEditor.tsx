import React, { memo, useMemo, useRef, useState } from 'react';
import {
  Play,
  Send,
  RotateCcw,
  Type,
  Code2,
  CheckCircle2,
  XCircle,
  Loader2
} from 'lucide-react';

interface CodeEditorProps {
  /** Current code (controlled by the parent) */
  value: string;
  onCodeChange: (code: string) => void;
  language: string;
  onLanguageChange: (lang: string) => void;
  onRunSample: (code: string, language: string) => void;
  onSubmitFull: (code: string, language: string) => void;
  onReset: () => void;
  isEvaluating: boolean;
  statusBadge?: string;
}

const INDENT = '    ';

/** Gutter only re-renders when the number of lines changes, not on every keystroke. */
const LineNumbers = memo(function LineNumbers({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>{i + 1}</div>
      ))}
    </>
  );
});

const countLines = (text: string) => {
  let n = 1;
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) n++;
  return n;
};

export const CodeEditor = memo(function CodeEditor({
  value: code,
  onCodeChange,
  language,
  onLanguageChange,
  onRunSample,
  onSubmitFull,
  onReset,
  isEvaluating,
  statusBadge
}: CodeEditorProps) {
  const [fontSize, setFontSize] = useState<number>(14);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const lineCount = useMemo(() => countLines(code), [code]);

  // Sync line numbers scrolling with textarea
  const handleScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const setCaret = (target: HTMLTextAreaElement, pos: number) => {
    requestAnimationFrame(() => {
      target.selectionStart = target.selectionEnd = pos;
    });
  };

  // Replace the current selection with text and move the caret after it.
  const insertAtCursor = (target: HTMLTextAreaElement, text: string) => {
    const start = target.selectionStart;
    const end = target.selectionEnd;
    onCodeChange(code.substring(0, start) + text + code.substring(end));
    setCaret(target, start + text.length);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;

    // Ctrl/Cmd+Enter runs sample tests, Ctrl/Cmd+Shift+Enter submits.
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (isEvaluating) return;
      if (e.shiftKey) onSubmitFull(code, language);
      else onRunSample(code, language);
      return;
    }

    // Escape lets keyboard users leave the editor (Tab is captured for indentation)
    if (e.key === 'Escape') {
      target.blur();
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        // Dedent the current line by up to one indent level
        const caret = target.selectionStart;
        const lineStart = code.lastIndexOf('\n', caret - 1) + 1;
        const leading = (code.slice(lineStart).match(/^ {1,4}/) || [''])[0].length;
        if (leading > 0) {
          onCodeChange(code.slice(0, lineStart) + code.slice(lineStart + leading));
          setCaret(target, Math.max(lineStart, caret - leading));
        }
        return;
      }
      insertAtCursor(target, INDENT);
      return;
    }

    // Auto-indent: keep current indentation, add a level after an opening token
    if (e.key === 'Enter' && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      const before = code.slice(0, target.selectionStart);
      const currentLine = before.slice(before.lastIndexOf('\n') + 1);
      let indent = (currentLine.match(/^[ \t]*/) || [''])[0];
      if (/[:{([]\s*$/.test(currentLine)) indent += INDENT;
      insertAtCursor(target, '\n' + indent);
    }
  };

  const accepted = statusBadge === 'ACCEPTED';

  return (
    <div className="flex flex-col h-full bg-[#0D121F] rounded-2xl border border-white/5 overflow-hidden shadow-2xl">
      {/* Editor Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-slate-900/80 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800/80 rounded-lg border border-white/5 text-xs text-slate-300">
            <Code2 className="w-3.5 h-3.5 text-teal-400" aria-hidden="true" />
            <select
              value={language}
              onChange={(e) => onLanguageChange(e.target.value)}
              aria-label="Programming language"
              className="bg-transparent text-slate-200 font-medium cursor-pointer rounded"
            >
              <option value="python" className="bg-slate-900 text-slate-200">Python 3</option>
              <option value="javascript" className="bg-slate-900 text-slate-200">JavaScript (Node)</option>
              <option value="cpp" className="bg-slate-900 text-slate-200">C++ (GCC 16)</option>
              <option value="c" className="bg-slate-900 text-slate-200">C (GCC)</option>
            </select>
          </div>

          {/* Font Size Adjuster */}
          <div className="flex items-center gap-1 bg-slate-800/40 px-2 py-0.5 rounded-lg border border-white/5 text-[11px] text-slate-400">
            <Type className="w-3 h-3 text-slate-400" aria-hidden="true" />
            <button
              type="button"
              onClick={() => setFontSize(Math.max(12, fontSize - 1))}
              className="hover:text-white px-1 font-bold rounded"
              aria-label="Decrease font size"
            >
              -
            </button>
            <span className="font-mono text-slate-300" aria-live="polite">{fontSize}px</span>
            <button
              type="button"
              onClick={() => setFontSize(Math.min(18, fontSize + 1))}
              className="hover:text-white px-1 font-bold rounded"
              aria-label="Increase font size"
            >
              +
            </button>
          </div>

          {statusBadge && (
            <span
              className={`hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                accepted
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-300 border-rose-500/20'
              }`}
            >
              {accepted
                ? <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                : <XCircle className="w-3 h-3" aria-hidden="true" />}
              {statusBadge.replace(/_/g, ' ')}
            </span>
          )}
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-lg border border-transparent hover:border-white/5 transition-colors"
            title="Reset to starter template"
            aria-label="Reset to starter template"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Reset</span>
          </button>

          <button
            type="button"
            onClick={() => onRunSample(code, language)}
            disabled={isEvaluating}
            aria-busy={isEvaluating}
            aria-keyshortcuts="Control+Enter"
            title="Run sample tests (Ctrl+Enter)"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800/80 hover:bg-slate-700/80 active:scale-95 rounded-lg border border-white/10 transition-[background-color,transform] disabled:opacity-50"
          >
            {isEvaluating ? (
              <Loader2 className="w-3.5 h-3.5 motion-safe:animate-spin text-slate-400" aria-hidden="true" />
            ) : (
              <Play className="w-3.5 h-3.5 text-teal-400 fill-teal-400" aria-hidden="true" />
            )}
            <span>Run Tests</span>
          </button>

          <button
            type="button"
            onClick={() => onSubmitFull(code, language)}
            disabled={isEvaluating}
            aria-busy={isEvaluating}
            aria-keyshortcuts="Control+Shift+Enter"
            title="Submit against all test cases (Ctrl+Shift+Enter)"
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 active:scale-95 rounded-lg shadow-sm shadow-teal-500/30 transition-[background-color,transform] disabled:opacity-50"
          >
            {isEvaluating ? (
              <Loader2 className="w-3.5 h-3.5 motion-safe:animate-spin" aria-hidden="true" />
            ) : (
              <Send className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>Submit Solution</span>
          </button>
        </div>
      </div>

      {/* Code Editor Body */}
      <div className="relative flex-1 flex overflow-hidden font-mono bg-[#0A0E17]">
        {/* Line Numbers */}
        <div
          ref={lineNumbersRef}
          aria-hidden="true"
          className="select-none py-3 px-3 text-right text-slate-500 bg-[#090D16]/50 border-r border-white/5 font-mono overflow-hidden"
          style={{ fontSize: `${fontSize}px`, lineHeight: `${fontSize * 1.5}px` }}
        >
          <LineNumbers count={lineCount} />
        </div>

        {/* Textarea Code Input */}
        <textarea
          ref={textareaRef}
          value={code}
          onChange={(e) => onCodeChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          aria-label={`Code editor (${language}). Tab indents; press Escape to leave the editor.`}
          className="flex-1 w-full h-full p-3 bg-transparent text-slate-100 resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500/60 overflow-auto font-mono leading-relaxed whitespace-pre"
          style={{
            fontSize: `${fontSize}px`,
            lineHeight: `${fontSize * 1.5}px`,
            tabSize: 4
          }}
          placeholder="// Write your solution here..."
        />
      </div>

      {/* Editor Status Footer */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-[#090D16] border-t border-white/5 text-[11px] text-slate-400 font-mono">
        <div className="flex items-center gap-3">
          <span>Lines: {lineCount}</span>
          <span>Chars: {code.length}</span>
          <span className="hidden md:inline text-slate-400">Ctrl+Enter run · Ctrl+Shift+Enter submit</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
          <span className="text-slate-400">Evaluated by C++ Engine (:8082)</span>
        </div>
      </div>
    </div>
  );
});
