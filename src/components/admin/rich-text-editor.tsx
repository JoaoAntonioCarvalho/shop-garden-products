"use client";

import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading2, Heading3, Italic, Link2, List, ListOrdered, Undo2 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

function Tool({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex size-8 items-center justify-center rounded-sm hover:bg-accent [&_svg]:size-4",
        active && "bg-accent text-accent-foreground",
      )}
    >
      {children}
    </button>
  );
}

function setLink(editor: Editor) {
  const current = (editor.getAttributes("link").href as string | undefined) ?? "";
  const href = window.prompt("Endereço do link (deixe vazio para remover)", current);
  if (href === null) return;
  if (href.trim() === "") editor.chain().focus().unsetLink().run();
  else editor.chain().focus().extendMarkRange("link").setLink({ href: href.trim() }).run();
}

/** Editor de texto rico do painel (Tiptap). Só oferece o que a loja renderiza: títulos, negrito, itálico, listas e links. */
export default function RichTextEditor({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        codeBlock: false,
        code: false,
        strike: false,
        horizontalRule: false,
        link: { openOnClick: false },
      }),
    ],
    content: value,
    editable: !disabled,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        id,
        role: "textbox",
        "aria-multiline": "true",
        class: "rich-editor min-h-40 px-3 py-2 text-sm outline-none",
      },
    },
    onUpdate: ({ editor: current }) => onChange(current.isEmpty ? "" : current.getHTML()),
  });
  if (!editor) return <div className="h-48 rounded-md border border-input bg-background" />;
  return (
    <div className="rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
      <div
        role="toolbar"
        aria-label="Formatação"
        className="flex flex-wrap gap-0.5 border-b border-border p-1"
      >
        <Tool
          label="Título"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 aria-hidden="true" />
        </Tool>
        <Tool
          label="Subtítulo"
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 aria-hidden="true" />
        </Tool>
        <Tool
          label="Negrito"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold aria-hidden="true" />
        </Tool>
        <Tool
          label="Itálico"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic aria-hidden="true" />
        </Tool>
        <Tool
          label="Lista"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List aria-hidden="true" />
        </Tool>
        <Tool
          label="Lista numerada"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered aria-hidden="true" />
        </Tool>
        <Tool label="Link" active={editor.isActive("link")} onClick={() => setLink(editor)}>
          <Link2 aria-hidden="true" />
        </Tool>
        <Tool label="Desfazer" onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 aria-hidden="true" />
        </Tool>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
