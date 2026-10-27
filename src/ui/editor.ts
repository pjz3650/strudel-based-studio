import { EditorState, StateEffect, StateField, Compartment, type Extension } from '@codemirror/state';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  drawSelection,
  Decoration,
  type DecorationSet,
} from '@codemirror/view';
import { javascript } from '@codemirror/lang-javascript';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import {
  indentOnInput,
  bracketMatching,
  syntaxHighlighting,
  HighlightStyle,
  indentUnit,
} from '@codemirror/language';
import { autocompletion, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { tags } from '@lezer/highlight';
import type { Settings } from '../shared/schema';
const markEffect = StateEffect.define<{ from: number; to: number; kind: string }[]>();
const marks = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, tr) {
    value = value.map(tr.changes);
    for (const effect of tr.effects)
      if (effect.is(markEffect))
        value = Decoration.set(
          effect.value
            .filter((r) => r.to > r.from && r.to <= tr.state.doc.length)
            .map((r) => Decoration.mark({ class: r.kind }).range(r.from, r.to)),
          true,
        );
    return value;
  },
  provide: (field) => EditorView.decorations.from(field),
});
const theme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'transparent',
    color: 'var(--text)',
    fontSize: 'var(--editor-size)',
  },
  '.cm-content': { fontFamily: 'var(--code-font)', padding: '24px 0', caretColor: 'var(--accent)' },
  '.cm-scroller': { overflow: 'auto', fontFamily: 'var(--code-font)', lineHeight: '1.9' },
  '.cm-gutters': {
    color: 'var(--muted)',
    backgroundColor: 'transparent',
    border: 'none',
    padding: '24px 12px 0 8px',
  },
  '.cm-line': { padding: '0 24px 0 8px' },
  '.cm-activeLine': { backgroundColor: 'var(--hover)' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': { backgroundColor: 'var(--selection)' },
  '.cm-tooltip': { backgroundColor: 'var(--panel)', color: 'var(--text)', border: '1px solid var(--border)' },
  '.cm-cursor': { borderLeftColor: 'var(--accent)' },
  '.cm-lineNumbers .cm-gutterElement': { minWidth: '24px' },
  '&.cm-focused': { outline: 'none' },
});
const syntax = HighlightStyle.define([
  { tag: tags.comment, color: 'var(--comment)' },
  { tag: tags.string, color: 'var(--green)' },
  { tag: [tags.number, tags.bool], color: 'var(--purple)' },
  { tag: [tags.keyword, tags.operator], color: 'var(--accent)' },
  { tag: [tags.function(tags.variableName), tags.propertyName], color: 'var(--function)' },
]);
const words = [
  'note',
  'sound',
  's',
  'stack',
  'slow',
  'fast',
  'gain',
  'lpf',
  'lpq',
  'room',
  'delay',
  'attack',
  'decay',
  'sustain',
  'release',
  'pan',
  'scale',
  'n',
  'euclid',
  'every',
  'sometimes',
  'rev',
  'jux',
  'off',
  'midi',
  'midichan',
  'ccn',
  'ccv',
  'velocity',
  'setcpm',
  'sine',
  'saw',
  'triangle',
  'perlin',
  'irand',
  'choose',
  'cat',
  'seq',
  'arrange',
  'pianoroll',
];
export class MusicalEditor {
  view: EditorView;
  private settingsSlot = new Compartment();
  private documents = new Map<string, EditorState>();
  private active = '';
  private signature = '';
  private extensions: Extension[];
  constructor(
    parent: HTMLElement,
    private changed: (code: string) => void,
    run: () => void,
    stop: () => void,
    settings: Settings,
  ) {
    this.extensions = [
      lineNumbers(),
      history(),
      drawSelection(),
      highlightActiveLine(),
      indentOnInput(),
      bracketMatching(),
      javascript(),
      closeBrackets(),
      marks,
      syntaxHighlighting(syntax),
      theme,
      autocompletion({
        override: [
          (context) => {
            const word = context.matchBefore(/[\w$]+/);
            return word
              ? { from: word.from, options: words.map((label) => ({ label, type: 'function' })) }
              : null;
          },
        ],
      }),
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...historyKeymap,
        indentWithTab,
        {
          key: 'Ctrl-.',
          run: () => {
            stop();
            return true;
          },
        },
      ]),
      this.settingsSlot.of(this.configuration(settings, run)),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          this.signature = '';
          this.changed(update.state.doc.toString());
        }
      }),
    ];
    this.view = new EditorView({ parent, state: EditorState.create({ extensions: this.extensions }) });
  }
  private configuration(settings: Settings, run: () => void) {
    return [
      indentUnit.of(' '.repeat(settings.indent)),
      keymap.of([
        {
          key: settings.runKey,
          run: () => {
            run();
            return true;
          },
        },
      ]),
    ];
  }
  configure(settings: Settings, run: () => void) {
    this.view.dispatch({ effects: this.settingsSlot.reconfigure(this.configuration(settings, run)) });
  }
  switch(id: string, code: string) {
    if (this.active === id) return;
    if (this.active) this.documents.set(this.active, this.view.state);
    const old = this.documents.get(id);
    const state = old ?? EditorState.create({ doc: code, extensions: this.extensions });
    this.active = id;
    this.view.setState(state);
    this.signature = '';
  }
  reset() {
    this.documents.clear();
    this.active = '';
  }
  replace(code: string) {
    this.view.dispatch({ changes: { from: 0, to: this.view.state.doc.length, insert: code } });
  }
  insert(code: string) {
    const selection = this.view.state.selection.main;
    this.view.dispatch({
      changes: { from: selection.from, to: selection.to, insert: code },
      selection: { anchor: selection.from + code.length },
    });
    this.view.focus();
  }
  highlight(haps: any[], enabled: boolean) {
    const ranges = enabled
      ? haps.flatMap((h) =>
          (h.context?.locations ?? []).map((l: any) => ({ from: l.start, to: l.end, kind: 'event-active' })),
        )
      : [];
    const signature = JSON.stringify(ranges);
    if (signature === this.signature) return;
    this.signature = signature;
    this.view.dispatch({ effects: markEffect.of(ranges) });
  }
  error(error: Error) {
    const line = /line\s+(\d+)/i.exec(error.message)?.[1];
    const row = this.view.state.doc.line(Math.min(Number(line) || 1, this.view.state.doc.lines));
    this.view.dispatch({ effects: markEffect.of([{ from: row.from, to: row.to, kind: 'code-error' }]) });
  }
  dispose() {
    this.view.destroy();
  }
}
