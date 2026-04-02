"use client";

import { $generateHtmlFromNodes, $generateNodesFromDOM } from "@lexical/html";
import { INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND } from "@lexical/list";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { TabIndentationPlugin } from "@lexical/react/LexicalTabIndentationPlugin";
import { Bold, Italic, List, ListOrdered } from "lucide-react";
import {
  $createParagraphNode,
  $getRoot,
  FORMAT_TEXT_COMMAND,
  type LexicalEditor,
} from "lexical";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ContentEditable as ShadcnContentEditable } from "@/components/editor/editor-ui/content-editable";
import { FloatingLinkEditorPlugin } from "@/components/editor/plugins/floating-link-editor-plugin";
import { LinkPlugin } from "@/components/editor/plugins/link-plugin";
import { ElementFormatToolbarPlugin } from "@/components/editor/plugins/toolbar/element-format-toolbar-plugin";
import { FontBackgroundToolbarPlugin } from "@/components/editor/plugins/toolbar/font-background-toolbar-plugin";
import { FontColorToolbarPlugin } from "@/components/editor/plugins/toolbar/font-color-toolbar-plugin";
import { LinkToolbarPlugin } from "@/components/editor/plugins/toolbar/link-toolbar-plugin";
import { ToolbarPlugin } from "@/components/editor/plugins/toolbar/toolbar-plugin";
import { editorTheme } from "@/components/editor/themes/editor-theme";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FULL_CONTENT_MAX_LENGTH } from "@/lib/full-content-constants";
import { cn } from "@/lib/utils";

import { richTextHtmlNodes } from "./rich-text-nodes";

import "@/components/editor/themes/editor-theme.css";

export { FULL_CONTENT_MAX_LENGTH } from "@/lib/full-content-constants";

function htmlFromEditor(editor: LexicalEditor): string {
  return editor.getEditorState().read(() => $generateHtmlFromNodes(editor, null));
}

function importHtmlIntoEditor(editor: LexicalEditor, html: string) {
  editor.update(
    () => {
      const root = $getRoot();
      root.clear();
      const trimmed = html.trim();
      if (!trimmed) {
        root.append($createParagraphNode());
        return;
      }
      try {
        const dom = new DOMParser().parseFromString(trimmed, "text/html");
        const nodes = $generateNodesFromDOM(editor, dom.body);
        if (nodes.length) root.append(...nodes);
        else root.append($createParagraphNode());
      } catch {
        root.append($createParagraphNode());
      }
    },
    { discrete: true }
  );
}

function HtmlSyncPlugin({
  value,
  onHtmlChange,
}: {
  value: string;
  onHtmlChange: (html: string) => void;
}) {
  const [editor] = useLexicalComposerContext();
  const skipNextExternalSync = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (skipNextExternalSync.current) {
      skipNextExternalSync.current = false;
      return;
    }
    const incoming = value ?? "";
    importHtmlIntoEditor(editor, incoming);
  }, [value, editor]);

  const flushChange = useCallback(() => {
    const html = htmlFromEditor(editor);
    const trimmed = html.trim();
    skipNextExternalSync.current = true;
    onHtmlChange(trimmed.length ? html : "");
  }, [editor, onHtmlChange]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <OnChangePlugin
      ignoreSelectionChange
      onChange={() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          debounceRef.current = null;
          flushChange();
        }, 150);
      }}
    />
  );
}

function RichTextToolbarRow({ setIsLinkEditMode }: { setIsLinkEditMode: (v: boolean) => void }) {
  const [editor] = useLexicalComposerContext();

  const formatBold = useCallback(() => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold");
  }, [editor]);

  const formatItalic = useCallback(() => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic");
  }, [editor]);

  const bulletList = useCallback(() => {
    editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
  }, [editor]);

  const orderedList = useCallback(() => {
    editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
  }, [editor]);

  return (
    <div className="vertical-align-middle flex flex-wrap items-center gap-1 border-b bg-muted/30 px-2 py-1.5">
      <ToolbarIconBtn label="Bold" onClick={formatBold}>
        <Bold className="size-3.5" />
      </ToolbarIconBtn>
      <ToolbarIconBtn label="Italic" onClick={formatItalic}>
        <Italic className="size-3.5" />
      </ToolbarIconBtn>
      <ToolbarIconBtn label="Bullet list" onClick={bulletList}>
        <List className="size-3.5" />
      </ToolbarIconBtn>
      <ToolbarIconBtn label="Numbered list" onClick={orderedList}>
        <ListOrdered className="size-3.5" />
      </ToolbarIconBtn>
      <Separator orientation="vertical" className="!h-7" />
      <ElementFormatToolbarPlugin />
      <Separator orientation="vertical" className="!h-7" />
      <FontColorToolbarPlugin />
      <FontBackgroundToolbarPlugin />
      <Separator orientation="vertical" className="!h-7" />
      <LinkToolbarPlugin setIsLinkEditMode={setIsLinkEditMode} />
    </div>
  );
}

function ToolbarIconBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-7"
            onClick={onClick}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export type RichTextHtmlEditorProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  maxLength?: number;
  className?: string;
  dir?: "ltr" | "rtl";
};

export function RichTextHtmlEditor({
  value,
  onChange,
  placeholder = "Start typing…",
  disabled = false,
  maxLength = FULL_CONTENT_MAX_LENGTH,
  className,
  dir = "ltr",
}: RichTextHtmlEditorProps) {
  const [floatingAnchorElem, setFloatingAnchorElem] = useState<HTMLDivElement | null>(null);
  const [isLinkEditMode, setIsLinkEditMode] = useState(false);

  const onFloatingAnchorRef = useCallback((el: HTMLDivElement | null) => {
    if (el !== null) setFloatingAnchorElem(el);
  }, []);

  const initialConfig = useMemo(
    () => ({
      namespace: "RichTextHtml",
      theme: editorTheme,
      nodes: richTextHtmlNodes,
      editable: !disabled,
      onError: (e: Error) => console.error(e),
    }),
    [disabled]
  );

  const v = value ?? "";
  const overLimit = v.length > maxLength;

  return (
    <div className={cn("grid gap-1", className)}>
      <div
        className={cn(
          "bg-background overflow-hidden rounded-lg border shadow-sm",
          overLimit && "border-destructive",
          disabled && "pointer-events-none opacity-60"
        )}
        dir={dir}
      >
        <LexicalComposer initialConfig={initialConfig}>
          <TooltipProvider>
            <ToolbarPlugin>
              {() => <RichTextToolbarRow setIsLinkEditMode={setIsLinkEditMode} />}
            </ToolbarPlugin>
            <div className="relative min-h-48">
              <RichTextPlugin
                contentEditable={
                  <div className="">
                    <div className="" ref={onFloatingAnchorRef}>
                      <ShadcnContentEditable
                        placeholder={placeholder}
                        className={cn(
                          "ContentEditable__root relative block min-h-48 overflow-auto px-4 py-3 text-sm focus:outline-none",
                          dir === "rtl" && "text-right"
                        )}
                      />
                    </div>
                  </div>
                }
                ErrorBoundary={LexicalErrorBoundary}
              />
              <HistoryPlugin />
              <ListPlugin />
              <TabIndentationPlugin />
              <LinkPlugin />
              <FloatingLinkEditorPlugin
                anchorElem={floatingAnchorElem}
                isLinkEditMode={isLinkEditMode}
                setIsLinkEditMode={setIsLinkEditMode}
              />
              <HtmlSyncPlugin value={v} onHtmlChange={onChange} />
            </div>
          </TooltipProvider>
        </LexicalComposer>
      </div>
      <p className={cn("text-[10px] text-muted-foreground", overLimit && "font-medium text-destructive")}>
        {v.length.toLocaleString()} / {maxLength.toLocaleString()}
      </p>
    </div>
  );
}
