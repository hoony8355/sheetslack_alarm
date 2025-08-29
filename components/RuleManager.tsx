import React, { useState } from 'react';
import type { Rule } from '../types';
import { SheetIcon, SlackIcon, TrashIcon } from './icons';

interface RuleManagerProps {
  rules: Rule[];
  onAddRule: (sheetUrl: string, sheetName: string, column: string, webhookUrl: string) => Promise<void>;
  onDeleteRule: (triggerId: string) => Promise<void>;
  isLoading: boolean;
}

export const RuleManager: React.FC<RuleManagerProps> = ({ rules, onAddRule, onDeleteRule, isLoading }) => {
  const [sheetUrl, setSheetUrl] = useState('');
  const [sheetName, setSheetName] = useState('');
  const [column, setColumn] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAdding(true);
    await onAddRule(sheetUrl, sheetName, column, webhookUrl);
    setSheetUrl('');
    setSheetName('');
    setColumn('');
    setWebhookUrl('');
    setIsAdding(false);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 mb-4">새 알림 규칙 추가</h2>
        <form onSubmit={handleSubmit} className="p-6 bg-white rounded-lg shadow-md border border-slate-200 space-y-4">
          <div className="flex flex-col">
            <label htmlFor="sheetUrl" className="text-sm font-medium text-slate-600 mb-1">구글 시트 URL</label>
            <input type="url" id="sheetUrl" value={sheetUrl} onChange={e => setSheetUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." required className="p-2 border rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
          </div>
          <div className="flex flex-col">
            <label htmlFor="sheetName" className="text-sm font-medium text-slate-600 mb-1">시트 이름 (탭 이름)</label>
            <input type="text" id="sheetName" value={sheetName} onChange={e => setSheetName(e.target.value)} placeholder="예: Sheet1" required className="p-2 border rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
          </div>
          <div className="flex flex-col">
            <label htmlFor="column" className="text-sm font-medium text-slate-600 mb-1">감시할 열 번호</label>
            <input type="number" id="column" value={column} onChange={e => setColumn(e.target.value)} placeholder="예: C열의 경우 3" min="1" required className="p-2 border rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
          </div>
          <div className="flex flex-col">
            <label htmlFor="webhookUrl" className="text-sm font-medium text-slate-600 mb-1">Slack 웹훅 URL</label>
            <input type="url" id="webhookUrl" value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder="https://hooks.slack.com/services/..." required className="p-2 border rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
          </div>
          <button type="submit" disabled={isAdding || isLoading} className="w-full bg-emerald-600 text-white font-bold py-2 px-4 rounded-md hover:bg-emerald-700 disabled:bg-slate-400 transition-colors duration-200 flex items-center justify-center">
            {isAdding ? '추가하는 중...' : '규칙 추가하기'}
          </button>
        </form>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-slate-800 mb-4">현재 알림 규칙</h2>
        {isLoading && <p className="text-slate-500">규칙을 불러오는 중...</p>}
        {!isLoading && rules.length === 0 ? (
          <p className="text-center text-slate-500 bg-white p-6 rounded-lg shadow-md border border-slate-200">활성화된 규칙이 없습니다. 위에서 새 규칙을 추가하여 시작하세요!</p>
        ) : (
          <div className="space-y-4">
            {rules.map((rule) => (
              <RuleItem key={rule.triggerId} rule={rule} onDeleteRule={onDeleteRule} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};


interface RuleItemProps {
  rule: Rule;
  onDeleteRule: (triggerId: string) => Promise<void>;
}

const RuleItem: React.FC<RuleItemProps> = ({ rule, onDeleteRule }) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (window.confirm('이 규칙을 정말로 삭제하시겠습니까?')) {
        setIsDeleting(true);
        await onDeleteRule(rule.triggerId);
        // component will be removed from parent, no need to set isDeleting to false
    }
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-md border border-slate-200 flex items-center justify-between transition-opacity duration-300">
      <div className="space-y-2 overflow-hidden">
        <div className="flex items-center space-x-2">
            <SheetIcon />
            <a href={rule.spreadsheetUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate" title={rule.spreadsheetUrl}>
                ...{rule.spreadsheetId.slice(-12)}
            </a>
            <span className="text-slate-500 text-sm">(시트: {rule.sheetName}, 열: {rule.column})</span>
        </div>
        <div className="flex items-center space-x-2">
            <SlackIcon />
            <p className="text-sm text-slate-600 truncate" title={rule.webhookUrl}>
                슬랙 채널로 알림 전송
            </p>
        </div>
      </div>
      <button 
        onClick={handleDelete}
        disabled={isDeleting}
        className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-100 disabled:text-slate-400 disabled:bg-transparent transition-colors"
        aria-label="Delete rule"
      >
        {isDeleting ? (
            <svg className="animate-spin h-5 w-5 text-slate-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
        ) : <TrashIcon />}
      </button>
    </div>
  )
}