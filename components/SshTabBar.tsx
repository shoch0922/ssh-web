/**
 * SSH Tab Bar Component
 *
 * Tab bar UI with drag-and-drop reordering, context menu, and keyboard shortcuts
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SshTabBarProps, SshSession } from '@/types/ssh';
import { MAX_TABS } from '@/lib/ssh-session-store';

// Sortable Tab Item Component
function SortableTabItem({
  session,
  isActive,
  isEditing,
  editingName,
  onSwitch,
  onClose,
  onStartRename,
  onRenameChange,
  onFinishRename,
  onCancelRename,
  onContextMenu,
  inputRef,
}: {
  session: SshSession;
  isActive: boolean;
  isEditing: boolean;
  editingName: string;
  onSwitch: () => void;
  onClose: (e: React.MouseEvent) => void;
  onStartRename: (e: React.MouseEvent) => void;
  onRenameChange: (value: string) => void;
  onFinishRename: () => void;
  onCancelRename: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: session.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        group relative flex items-center gap-2 px-3 py-2.5 min-w-[120px] max-w-[200px]
        border-r border-gray-200 dark:border-gray-700 cursor-pointer select-none
        transition-all duration-150
        ${isActive
          ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold'
          : 'bg-gray-100/70 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 hover:bg-gray-200/70 dark:hover:bg-gray-700/50'
        }
        ${isDragging ? 'shadow-lg ring-2 ring-green-500 z-50' : ''}
      `}
      onClick={() => !isEditing && onSwitch()}
      onDoubleClick={onStartRename}
      onContextMenu={onContextMenu}
    >
      {/* Status indicator */}
      <span
        className={`w-2 h-2 rounded-full flex-shrink-0 ${
          isActive ? 'bg-white' : 'bg-green-500'
        }`}
      />

      {/* Tab name (editable) */}
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editingName}
          onChange={(e) => onRenameChange(e.target.value)}
          onBlur={onFinishRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onFinishRename();
            } else if (e.key === 'Escape') {
              onCancelRename();
            }
          }}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-1 py-0.5 text-xs rounded outline-none ring-2 ring-green-500"
        />
      ) : (
        <span className="flex-1 truncate text-xs">{session.name}</span>
      )}

      {/* Close button */}
      {!isEditing && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onClose(e);
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            // preventDefaultはしない（クリックイベントが発火するように）
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            // preventDefaultはしない（クリックイベントが発火するように）
          }}
          className={`
            flex-shrink-0 w-4 h-4 rounded-sm flex items-center justify-center
            opacity-0 group-hover:opacity-100 transition-opacity
            ${isActive
              ? 'hover:bg-white/20 text-white'
              : 'hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400'
            }
          `}
          aria-label="Close tab"
        >
          <svg
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

export default function SshTabBar({
  sessions,
  activeSessionId,
  onTabSwitch,
  onTabClose,
  onTabRename,
  onCreateTab,
  onReorderTabs,
}: SshTabBarProps) {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    sessionId: string;
  } | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  // Focus input when editing starts
  useEffect(() => {
    if (editingSessionId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingSessionId]);

  // Handle drag and drop reordering
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || !onReorderTabs || active.id === over.id) return;

    const oldIndex = sessions.findIndex((s) => s.id === active.id);
    const newIndex = sessions.findIndex((s) => s.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const reordered = arrayMove(sessions, oldIndex, newIndex);
      onReorderTabs(reordered);
    }
  };

  // Handle context menu
  const handleContextMenu = (e: React.MouseEvent, sessionId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, sessionId });
  };

  // Start renaming a tab
  const startRename = (session: SshSession) => {
    setEditingSessionId(session.id);
    setEditingName(session.name);
    setContextMenu(null);
  };

  // Finish renaming a tab
  const finishRename = () => {
    if (editingSessionId && editingName.trim()) {
      onTabRename(editingSessionId, editingName.trim());
    }
    setEditingSessionId(null);
    setEditingName('');
  };

  // Cancel renaming
  const cancelRename = () => {
    setEditingSessionId(null);
    setEditingName('');
  };

  // Context menu actions
  const handleCloseOtherTabs = (sessionId: string) => {
    sessions.forEach(session => {
      if (session.id !== sessionId) {
        onTabClose(session.id);
      }
    });
    setContextMenu(null);
  };

  const handleCloseAllTabs = () => {
    sessions.forEach(session => {
      onTabClose(session.id);
    });
    setContextMenu(null);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (modifier && e.key === 't') {
        e.preventDefault();
        if (sessions.length < MAX_TABS) {
          onCreateTab();
        }
      } else if (modifier && e.key === 'w') {
        e.preventDefault();
        if (activeSessionId) {
          onTabClose(activeSessionId);
        }
      } else if (modifier && e.key === 'Tab') {
        e.preventDefault();
        const currentIndex = sessions.findIndex(s => s.id === activeSessionId);
        if (currentIndex >= 0) {
          const nextIndex = e.shiftKey
            ? (currentIndex - 1 + sessions.length) % sessions.length
            : (currentIndex + 1) % sessions.length;
          onTabSwitch(sessions[nextIndex].id);
        }
      } else if (modifier && e.key >= '1' && e.key <= '5') {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        if (sessions[index]) {
          onTabSwitch(sessions[index].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sessions, activeSessionId, onCreateTab, onTabClose, onTabSwitch]);

  return (
    <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex items-stretch">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sessions.map(s => s.id)} strategy={horizontalListSortingStrategy}>
          <div className="flex overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
            {sessions.map((session) => {
              const isActive = session.id === activeSessionId;
              const isEditing = session.id === editingSessionId;

              return (
                <SortableTabItem
                  key={session.id}
                  session={session}
                  isActive={isActive}
                  isEditing={isEditing}
                  editingName={editingName}
                  onSwitch={() => onTabSwitch(session.id)}
                  onClose={(e) => {
                    e.stopPropagation();
                    onTabClose(session.id);
                  }}
                  onStartRename={(e) => {
                    e.stopPropagation();
                    startRename(session);
                  }}
                  onRenameChange={setEditingName}
                  onFinishRename={finishRename}
                  onCancelRename={cancelRename}
                  onContextMenu={(e) => handleContextMenu(e, session.id)}
                  inputRef={inputRef}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {/* New tab button */}
      <button
        onClick={onCreateTab}
        disabled={sessions.length >= MAX_TABS}
        className={`
          flex items-center justify-center px-3 py-2.5 border-r border-gray-200 dark:border-gray-700
          transition-all
          ${sessions.length >= MAX_TABS
            ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-200'
          }
        `}
        title={sessions.length >= MAX_TABS ? `Maximum ${MAX_TABS} tabs reached` : 'New tab (Ctrl+T)'}
        aria-label="New tab"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
      </button>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[180px]"
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              const session = sessions.find(s => s.id === contextMenu.sessionId);
              if (session) startRename(session);
            }}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Rename Tab
          </button>

          <div className="border-t border-gray-200 dark:border-gray-700 my-1" />

          <button
            onClick={() => onTabClose(contextMenu.sessionId)}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Close Tab
          </button>
          <button
            onClick={() => handleCloseOtherTabs(contextMenu.sessionId)}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            disabled={sessions.length <= 1}
          >
            Close Other Tabs
          </button>
          <button
            onClick={handleCloseAllTabs}
            className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Close All Tabs
          </button>
        </div>
      )}
    </div>
  );
}
