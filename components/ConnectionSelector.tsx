/**
 * Connection Selector Component
 *
 * Modal dialog for selecting connection type (local/remote) and entering remote connection details
 */

'use client';

import { useState } from 'react';
import { ConnectionType, RemoteConnectionInfo, ConnectionSelectorProps } from '@/types/ssh';

export default function ConnectionSelector({ isOpen, onConfirm, onCancel }: ConnectionSelectorProps) {
  const [connectionType, setConnectionType] = useState<ConnectionType>('local');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('22');
  const [username, setUsername] = useState('');
  const [authMethod, setAuthMethod] = useState<'password' | 'privateKey'>('password');
  const [password, setPassword] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (connectionType === 'remote') {
      if (!host.trim()) {
        newErrors.host = 'ホスト名またはIPアドレスを入力してください';
      }

      const portNum = parseInt(port);
      if (!port || isNaN(portNum) || portNum < 1 || portNum > 65535) {
        newErrors.port = 'ポート番号は1-65535の範囲で入力してください';
      }

      if (!username.trim()) {
        newErrors.username = 'ユーザー名を入力してください';
      }

      if (authMethod === 'password' && !password) {
        newErrors.password = 'パスワードを入力してください';
      }

      if (authMethod === 'privateKey' && !privateKey.trim()) {
        newErrors.privateKey = '秘密鍵ファイルのパスを入力してください';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleConfirm = () => {
    if (!validateForm()) {
      return;
    }

    if (connectionType === 'local') {
      onConfirm('local');
    } else {
      const remoteInfo: RemoteConnectionInfo = {
        host: host.trim(),
        port: parseInt(port),
        username: username.trim(),
        authMethod,
        password: authMethod === 'password' ? password : undefined,
        privateKey: authMethod === 'privateKey' ? privateKey.trim() : undefined,
        passphrase: authMethod === 'privateKey' && passphrase ? passphrase : undefined,
      };
      onConfirm('remote', remoteInfo);
    }

    // Reset form
    resetForm();
  };

  const handleCancel = () => {
    resetForm();
    onCancel();
  };

  const resetForm = () => {
    setConnectionType('local');
    setHost('');
    setPort('22');
    setUsername('');
    setAuthMethod('password');
    setPassword('');
    setPrivateKey('');
    setPassphrase('');
    setErrors({});
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="glass rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-6">新規接続</h2>

          {/* Connection Type Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-3">接続タイプ</label>
            <div className="flex gap-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="connectionType"
                  value="local"
                  checked={connectionType === 'local'}
                  onChange={(e) => setConnectionType(e.target.value as ConnectionType)}
                  className="mr-2"
                />
                <span>ローカル</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="connectionType"
                  value="remote"
                  checked={connectionType === 'remote'}
                  onChange={(e) => setConnectionType(e.target.value as ConnectionType)}
                  className="mr-2"
                />
                <span>リモート</span>
              </label>
            </div>
          </div>

          {/* Remote Connection Form */}
          {connectionType === 'remote' && (
            <div className="space-y-4">
              {/* Host */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  ホスト名 / IPアドレス <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-600"
                  placeholder="example.com または 192.168.1.100"
                />
                {errors.host && <p className="text-red-500 text-sm mt-1">{errors.host}</p>}
              </div>

              {/* Port */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  ポート番号 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-600"
                  placeholder="22"
                />
                {errors.port && <p className="text-red-500 text-sm mt-1">{errors.port}</p>}
              </div>

              {/* Username */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  ユーザー名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-600"
                  placeholder="username"
                  autoComplete="username"
                />
                {errors.username && <p className="text-red-500 text-sm mt-1">{errors.username}</p>}
              </div>

              {/* Auth Method */}
              <div>
                <label className="block text-sm font-medium mb-2">認証方法</label>
                <div className="flex gap-4">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="authMethod"
                      value="password"
                      checked={authMethod === 'password'}
                      onChange={(e) => setAuthMethod(e.target.value as 'password' | 'privateKey')}
                      className="mr-2"
                    />
                    <span>パスワード</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="authMethod"
                      value="privateKey"
                      checked={authMethod === 'privateKey'}
                      onChange={(e) => setAuthMethod(e.target.value as 'password' | 'privateKey')}
                      className="mr-2"
                    />
                    <span>秘密鍵</span>
                  </label>
                </div>
              </div>

              {/* Password Auth */}
              {authMethod === 'password' && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    パスワード <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-600"
                    placeholder="パスワード"
                    autoComplete="current-password"
                  />
                  {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    ⚠️ パスワードは保存されません（セキュリティのため）
                  </p>
                </div>
              )}

              {/* Private Key Auth */}
              {authMethod === 'privateKey' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      秘密鍵ファイルパス <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={privateKey}
                      onChange={(e) => setPrivateKey(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-600"
                      placeholder="/home/user/.ssh/id_rsa"
                    />
                    {errors.privateKey && <p className="text-red-500 text-sm mt-1">{errors.privateKey}</p>}
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      サーバー上の秘密鍵ファイルの絶対パス
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      パスフレーズ（オプション）
                    </label>
                    <input
                      type="password"
                      value={passphrase}
                      onChange={(e) => setPassphrase(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-600"
                      placeholder="秘密鍵のパスフレーズ"
                      autoComplete="off"
                    />
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      秘密鍵が暗号化されている場合のみ入力
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Local Connection Info */}
          {connectionType === 'local' && (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 rounded-md">
              <p className="text-sm">
                ローカル接続では、このサーバー上で直接ターミナルセッションを開始します。
                tmuxセッションが利用可能な場合、セッションは永続化されます。
              </p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={handleConfirm}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              接続
            </button>
            <button
              onClick={handleCancel}
              className="flex-1 px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-white rounded-md hover:bg-gray-400 dark:hover:bg-gray-700 transition-colors"
            >
              キャンセル
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
