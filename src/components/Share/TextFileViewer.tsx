// inspect-drive\src\components\Share\TextFileViewer.tsx

"use client";

import { useState, useEffect, useRef } from "react";

interface TextFileViewerProps {
  filePath: string;
}

export default function TextFileViewer({ filePath }: TextFileViewerProps) {
  const [content, setContent] = useState("");
  const [copied, setCopied] = useState(false);
  const [hasScrollbar, setHasScrollbar] = useState(false);
  const preRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    fetch(filePath)
      .then((res) => res.text())
      .then((data) => setContent(data))
      .catch((err) => console.error("Error fetching file content:", err));
  }, [filePath]);

  useEffect(() => {
    const preElement = preRef.current;
    if (preElement) {
      // ถ้า scrollHeight > clientHeight แสดงว่ามี scrollbar
      setHasScrollbar(preElement.scrollHeight > preElement.clientHeight);
    }
  }, [content]);

  const copyToClipboard = () => {
    navigator.clipboard
      .writeText(content)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch((err) => console.error("Copy failed:", err));
  };

  return (
    <div className="w-full relative">
      <pre
        ref={preRef}
        className="w-full h-[70vh] border rounded-md shadow-sm p-4 overflow-auto"
      >
        {content}
      </pre>
      <button
        onClick={copyToClipboard}
        className={`absolute top-3 ${hasScrollbar ? "right-4" : "right-3"} bg-green-500 hover:bg-green-600 text-white py-1 px-3 rounded`}
      >
        {copied ? "คัดลอกแล้ว" : "คัดลอก"}
      </button>
    </div>
  );
}
