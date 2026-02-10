'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import { Bold, Italic, Heading2, List, ListOrdered, Link as LinkIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface TiptapEditorProps {
  content: string
  onChange: (html: string) => void
}

export default function TiptapEditor({ content, onChange }: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
    ],
    content,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
  })

  if (!editor) return null

  function toggleLink() {
    if (!editor) return
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run()
      return
    }
    const url = window.prompt('URL')
    if (url) {
      editor.chain().focus().setLink({ href: url }).run()
    }
  }

  const tools = [
    { icon: Bold, action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold') },
    { icon: Italic, action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic') },
    { icon: Heading2, action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive('heading', { level: 2 }) },
    { icon: List, action: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive('bulletList') },
    { icon: ListOrdered, action: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive('orderedList') },
    { icon: LinkIcon, action: toggleLink, active: editor.isActive('link') },
  ]

  return (
    <div className="rounded-lg border border-input focus-within:border-primary focus-within:ring-1 focus-within:ring-ring">
      <div className="flex gap-1 border-b border-input p-1">
        {tools.map((tool, i) => {
          const Icon = tool.icon
          return (
            <Button
              key={i}
              type="button"
              variant="ghost"
              size="sm"
              className={cn('h-8 w-8 p-0', tool.active && 'bg-accent')}
              onClick={tool.action}
            >
              <Icon className="h-4 w-4" />
            </Button>
          )
        })}
      </div>
      <EditorContent editor={editor} className="prose prose-sm max-w-none px-4 py-3 [&_.tiptap]:min-h-[200px] [&_.tiptap]:outline-none" />
    </div>
  )
}
