'use client';

import { useState, useEffect } from 'react';

interface SearchResult {
  filePath: string;
  line: number;
  column: number;
  content: string;
  matchStart: number;
  matchEnd: number;
}

interface SearchPanelProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  onResultClick: (filePath: string, line: number, column: number) => void;
}

export default function SearchPanel({ isOpen, onClose, sessionId, onResultClick }: SearchPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [isRegex, setIsRegex] = useState(false);
  const [isCaseSensitive, setIsCaseSensitive] = useState(false);
  const [isWholeWord, setIsWholeWord] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showReplace, setShowReplace] = useState(false);

  useEffect(() => {
    if (searchQuery.length >= 2) {
      performSearch();
    } else {
      setResults([]);
    }
  }, [searchQuery, isRegex, isCaseSensitive, isWholeWord]);

  const performSearch = async () => {
    setIsSearching(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/sessions/${sessionId}/search`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            query: searchQuery,
            regex: isRegex,
            caseSensitive: isCaseSensitive,
            wholeWord: isWholeWord,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setResults(data.results || []);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const highlightMatch = (content: string, start: number, end: number) => {
    return (
      <>
        {content.substring(0, start)}
        <mark className="bg-yellow-400 text-black px-0.5">{content.substring(start, end)}</mark>
        {content.substring(end)}
      </>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="absolute top-0 right-0 w-96 h-full bg-gray-800 border-l border-gray-700 flex flex-col z-10">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">Search</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            title="Close search"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative mb-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search in files..."
            className="w-full bg-gray-900 text-white px-3 py-2 pr-10 rounded border border-gray-700 focus:outline-none focus:border-blue-500 text-sm"
            autoFocus
          />
          <div className="absolute right-2 top-2">
            {isSearching ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
            ) : (
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
          </div>
        </div>

        {/* Replace Input (optional) */}
        {showReplace && (
          <div className="mb-2">
            <input
              type="text"
              value={replaceQuery}
              onChange={(e) => setReplaceQuery(e.target.value)}
              placeholder="Replace with..."
              className="w-full bg-gray-900 text-white px-3 py-2 rounded border border-gray-700 focus:outline-none focus:border-blue-500 text-sm"
            />
          </div>
        )}

        {/* Options */}
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => setIsCaseSensitive(!isCaseSensitive)}
            className={`px-2 py-1 text-xs rounded ${
              isCaseSensitive ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
            }`}
            title="Match Case"
          >
            Aa
          </button>
          <button
            onClick={() => setIsWholeWord(!isWholeWord)}
            className={`px-2 py-1 text-xs rounded ${
              isWholeWord ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
            }`}
            title="Match Whole Word"
          >
            Ab
          </button>
          <button
            onClick={() => setIsRegex(!isRegex)}
            className={`px-2 py-1 text-xs rounded ${
              isRegex ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
            }`}
            title="Use Regular Expression"
          >
            .*
          </button>
          <button
            onClick={() => setShowReplace(!showReplace)}
            className="ml-auto px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
          >
            {showReplace ? 'Hide Replace' : 'Replace'}
          </button>
        </div>

        {/* Results Count */}
        <div className="text-xs text-gray-400">
          {results.length > 0 ? `${results.length} results` : searchQuery.length >= 2 ? 'No results' : 'Type to search'}
        </div>
      </div>

      {/* Results List */}
      <div className="flex-1 overflow-y-auto">
        {results.map((result, index) => (
          <div
            key={`${result.filePath}-${result.line}-${index}`}
            onClick={() => onResultClick(result.filePath, result.line, result.column)}
            className="p-3 border-b border-gray-700 hover:bg-gray-700/50 cursor-pointer transition-colors"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-blue-400 font-mono">{result.filePath}</span>
              <span className="text-xs text-gray-500">
                {result.line}:{result.column}
              </span>
            </div>
            <div className="text-sm text-gray-300 font-mono overflow-hidden text-ellipsis whitespace-nowrap">
              {highlightMatch(result.content, result.matchStart, result.matchEnd)}
            </div>
          </div>
        ))}
      </div>

      {/* Replace Actions */}
      {showReplace && results.length > 0 && (
        <div className="p-3 border-t border-gray-700 bg-gray-900/50">
          <div className="flex gap-2">
            <button
              onClick={() => console.log('Replace one')}
              className="flex-1 px-3 py-2 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Replace
            </button>
            <button
              onClick={() => console.log('Replace all')}
              className="flex-1 px-3 py-2 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
            >
              Replace All
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
