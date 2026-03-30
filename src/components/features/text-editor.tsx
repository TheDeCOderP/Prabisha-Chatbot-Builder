'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Editor } from '@tinymce/tinymce-react';

type TextEditorProps = {
    editorRef: any;
    handleInputChange: any;
    name: string;
    value: string;
};

export default function TextEditor({
  editorRef,
  handleInputChange,
  name,
  value,
}: TextEditorProps) {
  const { resolvedTheme } = useTheme();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return null;

  return (
    <Editor
      apiKey="3mh7dx1a38vnr50y4s8lwk76i4zzpn9j7c6xysgdhf4w3gqr"
      onInit={(_, editor) => (editorRef.current = editor)}
      value={value}
      onEditorChange={(content) =>
        handleInputChange({ target: { name, value: content } })
      }
      init={{
        height: 300,
        menubar: false,

        skin: resolvedTheme === 'dark' ? 'oxide-dark' : 'oxide',
        content_css: resolvedTheme === 'dark' ? 'dark' : 'default',

        plugins: [
          'advlist', 'autolink', 'lists', 'link', 'image', 'charmap',
          'preview', 'anchor', 'searchreplace', 'visualblocks', 'code',
          'fullscreen', 'insertdatetime', 'media', 'table', 'help', 'wordcount',
          "anchor", "link",
        ],

        toolbar:
          'undo redo | blocks | bold italic forecolor | | link | anchor' +
          'alignleft aligncenter alignright alignjustify | ' +
          'bullist numlist outdent indent | removeformat | help' +
          '',
        content_style:
          'body { font-family:Helvetica,Arial,sans-serif; font-size:14px }',
      }}
    />
  );
}
