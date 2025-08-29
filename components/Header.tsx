import React from 'react';

interface HeaderProps {
    userEmail?: string;
    onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ userEmail, onLogout }) => {
  return (
    <header className="bg-white shadow-md">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-slate-800">
          <span className="text-emerald-600">원클릭</span> 스프레드시트 슬랙 알람
        </h1>
        {userEmail && (
            <div className="flex items-center space-x-4">
                <span className="text-sm text-slate-600 hidden sm:block">{userEmail}</span>
                <button 
                    onClick={onLogout}
                    className="bg-slate-200 text-slate-700 px-3 py-1 rounded-md text-sm font-medium hover:bg-slate-300 transition-colors"
                >
                    로그아웃
                </button>
            </div>
        )}
      </div>
    </header>
  );
};