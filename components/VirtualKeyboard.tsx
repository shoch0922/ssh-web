'use client';

import { useState, useEffect } from 'react';

interface VirtualKeyboardProps {
  onKeyPress: (key: string) => void;
  disabled?: boolean;
  onFocusTerminal?: () => void;
}

export default function VirtualKeyboard({ onKeyPress, disabled = false, onFocusTerminal }: VirtualKeyboardProps) {
  const [isVisible, setIsVisible] = useState(true); // PC時も初期表示
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // モバイルデバイスかどうかを検出
    const checkMobile = () => {
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isSmallScreen = window.innerWidth < 768;
      setIsMobile(isTouchDevice || isSmallScreen);
      // モバイル時は常に表示、PC時は現在の状態を維持
      if (isTouchDevice || isSmallScreen) {
        setIsVisible(true);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleKeyPress = (key: string, e?: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    onKeyPress(key);
    // ターミナルにフォーカスを戻す
    if (onFocusTerminal) {
      setTimeout(() => {
        onFocusTerminal();
      }, 0);
    }
  };

  const specialKeys = [
    { label: 'Ctrl+C', key: '\x03', title: '中断' },
    { label: 'Ctrl+D', key: '\x04', title: '終了' },
    { label: 'Tab', key: '\t', title: 'タブ' },
    { label: 'Esc', key: '\x1b', title: 'エスケープ' },
    { label: 'Enter', key: '\r', title: '改行' },
    { label: 'Backspace', key: '\x7f', title: '削除' },
  ];

  const arrowKeys = [
    { label: '↑', key: '\x1b[A', title: '上矢印' },
    { label: '↓', key: '\x1b[B', title: '下矢印' },
    { label: '←', key: '\x1b[D', title: '左矢印' },
    { label: '→', key: '\x1b[C', title: '右矢印' },
  ];

  // 非表示の場合、折りたたみボタンのみ表示
  if (!isVisible) {
    return (
      <div className="w-full md:w-12 h-12 md:h-full bg-gray-900 dark:bg-gray-800 border-t md:border-t-0 md:border-l border-gray-700 flex items-center justify-center">
        <button
          onClick={() => setIsVisible(true)}
          className="text-gray-400 hover:text-gray-200 transition-colors p-2"
          title="バーチャルキーボードを表示"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="w-full md:w-64 h-auto md:h-full bg-gray-900 dark:bg-gray-800 border-t md:border-t-0 md:border-l border-gray-700 shadow-lg overflow-y-auto flex flex-col max-h-[40vh] md:max-h-none">
      <div className="px-3 py-3 flex-shrink-0">
        {/* ヘッダー */}
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-gray-300">バーチャルキーボード</h3>
        </div>

        {/* 特殊キー */}
        <div className="flex flex-wrap gap-2 mb-3">
          {specialKeys.map((key) => (
            <button
              key={key.label}
              type="button"
              onClick={(e) => handleKeyPress(key.key, e)}
              disabled={disabled}
              className="px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation flex-shrink-0"
              title={key.title}
            >
              {key.label}
            </button>
          ))}
        </div>

        {/* 矢印キー */}
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="grid grid-cols-3 gap-2 w-32">
            <div></div>
            <button
              type="button"
              onClick={(e) => handleKeyPress(arrowKeys[0].key, e)}
              disabled={disabled}
              className="px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
              title={arrowKeys[0].title}
            >
              {arrowKeys[0].label}
            </button>
            <div></div>
            <button
              type="button"
              onClick={(e) => handleKeyPress(arrowKeys[2].key, e)}
              disabled={disabled}
              className="px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
              title={arrowKeys[2].title}
            >
              {arrowKeys[2].label}
            </button>
            <div></div>
            <button
              type="button"
              onClick={(e) => handleKeyPress(arrowKeys[3].key, e)}
              disabled={disabled}
              className="px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
              title={arrowKeys[3].title}
            >
              {arrowKeys[3].label}
            </button>
            <div></div>
            <button
              type="button"
              onClick={(e) => handleKeyPress(arrowKeys[1].key, e)}
              disabled={disabled}
              className="px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
              title={arrowKeys[1].title}
            >
              {arrowKeys[1].label}
            </button>
            <div></div>
          </div>
        </div>

        {/* よく使うコマンド */}
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'clear', key: 'clear\n' },
            { label: 'ls', key: 'ls\n' },
            { label: 'pwd', key: 'pwd\n' },
            { label: 'cd ~', key: 'cd ~\n' },
          ].map((cmd) => (
            <button
              key={cmd.label}
              type="button"
              onClick={(e) => handleKeyPress(cmd.key, e)}
              disabled={disabled}
              className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-400 text-white text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation flex-shrink-0"
            >
              {cmd.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-shrink-0 px-3 pb-3">
        <button
          onClick={() => setIsVisible(false)}
          className="w-full px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium transition-colors"
          title="折りたたむ"
        >
          折りたたむ
        </button>
      </div>
    </div>
  );
}

