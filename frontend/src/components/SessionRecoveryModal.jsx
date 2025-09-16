import React, { useState } from 'react';
import { ClockIcon, DocumentIcon, TrashIcon } from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';

export const SessionRecoveryModal = ({
  isOpen,
  sessionData = [],
  onRecover,
  onDiscard,
  onDiscardAll,
  onClose
}) => {
  const [selectedSessions, setSelectedSessions] = useState(new Set());

  if (!isOpen) return null;

  const handleSessionSelect = (sessionKey) => {
    const newSelection = new Set(selectedSessions);
    if (newSelection.has(sessionKey)) {
      newSelection.delete(sessionKey);
    } else {
      newSelection.add(sessionKey);
    }
    setSelectedSessions(newSelection);
  };

  const handleSelectAll = () => {
    if (selectedSessions.size === sessionData.length) {
      setSelectedSessions(new Set());
    } else {
      setSelectedSessions(new Set(sessionData.map(s => s.key)));
    }
  };

  const handleBatchRecover = () => {
    selectedSessions.forEach(sessionKey => {
      onRecover(sessionKey);
    });
    setSelectedSessions(new Set());
  };

  const handleBatchDiscard = () => {
    selectedSessions.forEach(sessionKey => {
      onDiscard(sessionKey);
    });
    setSelectedSessions(new Set());
  };

  const formatSessionName = (key) => {
    // Convert camelCase/snake_case to readable format
    return key
      .replace(/[_-]/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getSessionType = (key) => {
    if (key.includes('event') || key.includes('appointment')) return 'Event';
    if (key.includes('schedule') || key.includes('calendar')) return 'Schedule';
    if (key.includes('task') || key.includes('todo')) return 'Task';
    if (key.includes('note') || key.includes('memo')) return 'Note';
    return 'Data';
  };

  const formatDataSize = (data) => {
    const sizeInBytes = JSON.stringify(data).length;
    if (sizeInBytes < 1024) return `${sizeInBytes} B`;
    if (sizeInBytes < 1024 * 1024) return `${(sizeInBytes / 1024).toFixed(1)} KB`;
    return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" />

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full sm:p-6">
          <div className="sm:flex sm:items-start">
            <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10">
              <ClockIcon className="h-6 w-6 text-blue-600" />
            </div>

            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Recover Previous Sessions
              </h3>

              <div className="mt-2">
                <p className="text-sm text-gray-500">
                  We found {sessionData.length} unsaved session{sessionData.length !== 1 ? 's' : ''}
                  from your previous work. You can recover or discard them.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6">
            {/* Batch actions */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={selectedSessions.size === sessionData.length && sessionData.length > 0}
                  onChange={handleSelectAll}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">
                  Select all ({selectedSessions.size} selected)
                </span>
              </div>

              <div className="flex space-x-2">
                {selectedSessions.size > 0 && (
                  <>
                    <button
                      onClick={handleBatchRecover}
                      className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Recover Selected
                    </button>
                    <button
                      onClick={handleBatchDiscard}
                      className="text-xs px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Discard Selected
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Session list */}
            <div className="max-h-64 overflow-y-auto space-y-3">
              {sessionData.map((session) => (
                <div
                  key={session.key}
                  className={`
                    p-3 border rounded-lg cursor-pointer transition-colors
                    ${selectedSessions.has(session.key)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                    }
                  `}
                  onClick={() => handleSessionSelect(session.key)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <input
                        type="checkbox"
                        checked={selectedSessions.has(session.key)}
                        onChange={() => handleSessionSelect(session.key)}
                        className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />

                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <DocumentIcon className="h-4 w-4 text-gray-400" />
                          <h4 className="text-sm font-medium text-gray-900">
                            {formatSessionName(session.key)}
                          </h4>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                            {getSessionType(session.key)}
                          </span>
                        </div>

                        <div className="mt-1 flex items-center space-x-4 text-xs text-gray-500">
                          <span>
                            {formatDistanceToNow(new Date(session.timestamp), { addSuffix: true })}
                          </span>
                          <span>
                            {formatDataSize(session.data)}
                          </span>
                        </div>

                        {/* Preview of data */}
                        <div className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded max-h-16 overflow-hidden">
                          <pre className="whitespace-pre-wrap break-words">
                            {JSON.stringify(session.data, null, 1).slice(0, 100)}
                            {JSON.stringify(session.data).length > 100 ? '...' : ''}
                          </pre>
                        </div>
                      </div>
                    </div>

                    <div className="flex space-x-1 ml-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRecover(session.key);
                        }}
                        className="p-1 text-blue-600 hover:text-blue-800"
                        title="Recover this session"
                      >
                        <ClockIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDiscard(session.key);
                        }}
                        className="p-1 text-red-600 hover:text-red-800"
                        title="Discard this session"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row-reverse space-y-2 sm:space-y-0 sm:space-x-reverse sm:space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:w-auto sm:text-sm"
            >
              Close
            </button>

            <button
              type="button"
              onClick={onDiscardAll}
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:w-auto sm:text-sm"
            >
              Discard All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};