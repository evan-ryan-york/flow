'use client';

import { PanelResizeHandle } from 'react-resizable-panels';

export function ResizeHandle() {
  return (
    <PanelResizeHandle className="group relative w-2 bg-gray-100 hover:bg-blue-50 transition-colors cursor-col-resize">
      {/* Visual indicator line */}
      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1 bg-gray-300 group-hover:bg-blue-500 transition-colors" />

      {/* Drag dots (visible on hover) */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex flex-col gap-1">
          <div className="w-1 h-1 rounded-full bg-gray-400 group-hover:bg-blue-600" />
          <div className="w-1 h-1 rounded-full bg-gray-400 group-hover:bg-blue-600" />
          <div className="w-1 h-1 rounded-full bg-gray-400 group-hover:bg-blue-600" />
        </div>
      </div>
    </PanelResizeHandle>
  );
}
