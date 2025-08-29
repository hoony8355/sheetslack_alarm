import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { RuleManager } from './components/RuleManager';
import { GoogleIcon } from './components/icons';
import { GOOGLE_CLIENT_ID, GOOGLE_API_SCOPES, SCRIPT_TITLE, ALERTER_APPS_SCRIPT_CODE } from './constants';
// Fix: Import GoogleTokenResponse to use as a type for the auth token.
import type { Rule, GApiResponse, AppStatus, GoogleTokenResponse } from './types';

// A placeholder check for the Client ID. In a real app, this should be handled via environment variables.
if (GOOGLE_CLIENT_ID === 'YOUR_GOOGLE_CLOUD_PROJECT_CLIENT_ID') {
  alert('오류: Google Client ID가 설정되지 않았습니다. constants.ts 파일에서 YOUR_GOOGLE_CLOUD_PROJECT_CLIENT_ID 값을 실제 ID로 교체해주세요.');
}

// Global google object from GSI script
declare global {
  interface Window {
    google: any;
    tokenClient: any;
    // Fix: Add gapi to the Window interface to resolve property does not exist error.
    gapi: any;
  }
}

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>('INITIAL');
  const [error, setError] = useState<string | null>(null);
  // Fix: Use the imported GoogleTokenResponse type instead of the missing google namespace.
  const [token, setToken] = useState<GoogleTokenResponse | null>(null);
  const [user, setUser] = useState<{ email: string; name: string; picture: string } | null>(null);
  
  const [scriptId, setScriptId] = useState<string | null>(localStorage.getItem('scriptId'));
  const [deploymentUrl, setDeploymentUrl] = useState<string | null>(localStorage.getItem('deploymentUrl'));
  const [rules, setRules] = useState<Rule[]>([]);
  const [isLoadingRules, setIsLoadingRules] = useState(false);

  // Initialize Google Auth Client
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.async = true;
    script.defer = true;
    script.onload = () => {
        window.gapi.load('client', () => {
            window.tokenClient = window.google.accounts.oauth2.initTokenClient({
                client_id: GOOGLE_CLIENT_ID,
                scope: GOOGLE_API_SCOPES,
                // Fix: Use the imported GoogleTokenResponse type for the callback parameter.
                callback: (tokenResponse: GoogleTokenResponse) => {
                    if (tokenResponse.error) {
                        setError(`Google 인증 오류: ${tokenResponse.error_description}`);
                        setStatus('ERROR');
                        return;
                    }
                    setToken(tokenResponse);
                },
            });
            setStatus(token ? 'LOGGED_IN' : 'LOGGED_OUT');
        });
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch user profile when token is available
  useEffect(() => {
    const fetchUser = async () => {
      if (token) {
        try {
          const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { 'Authorization': `Bearer ${token.access_token}` },
          });
          if (!response.ok) throw new Error('사용자 정보를 가져오는 데 실패했습니다.');
          const data = await response.json();
          setUser(data);
          setStatus(scriptId && deploymentUrl ? 'INSTALLED' : 'LOGGED_IN');
        } catch (e: any) {
          setError(e.message);
          setStatus('ERROR');
        }
      }
    };
    fetchUser();
  }, [token, scriptId, deploymentUrl]);


  // Function to fetch rules from deployed web app
  const fetchRules = useCallback(async () => {
    if (!deploymentUrl || !token) return;
    setIsLoadingRules(true);
    setError(null);
    try {
      const response = await fetch(`${deploymentUrl}?action=list`, {
        headers: { Authorization: `Bearer ${token.access_token}` },
      });
      const text = await response.text();
      const result: GApiResponse<Rule[]> = JSON.parse(text);
      
      if (result.status === 'success' && result.data) {
        setRules(result.data);
      } else {
        throw new Error(result.message || '규칙 목록을 가져오는 데 실패했습니다.');
      }
    } catch (e: any) {
      setError(`규칙을 가져올 수 없습니다: ${e.message}. 봇을 재설치하거나 다시 인증해야 할 수 있습니다.`);
    } finally {
      setIsLoadingRules(false);
    }
  }, [deploymentUrl, token]);


  // Fetch rules when app is installed
  useEffect(() => {
    if (status === 'INSTALLED') {
      fetchRules();
    }
  }, [status, fetchRules]);


  // --- API Handlers ---
  const handleLogin = () => {
    setError(null);
    window.tokenClient.requestAccessToken();
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    setScriptId(null);
    setDeploymentUrl(null);
    setRules([]);
    localStorage.removeItem('scriptId');
    localStorage.removeItem('deploymentUrl');
    setStatus('LOGGED_OUT');
    window.google.accounts.oauth2.revoke(token?.access_token, () => {});
  };

  const handleInstallBot = async () => {
    if (!token) {
      setError("인증 토큰이 없습니다.");
      return;
    }
    setStatus('INSTALLING');
    setError(null);

    try {
      // 1. Create Apps Script Project
      const createResponse = await fetch('https://script.googleapis.com/v1/projects', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: SCRIPT_TITLE,
          files: [{ name: 'main', type: 'SERVER_JS', source: ALERTER_APPS_SCRIPT_CODE }],
        }),
      });
      if (!createResponse.ok) throw new Error(`스크립트 생성 실패: ${await createResponse.text()}`);
      const scriptData = await createResponse.json();
      const newScriptId = scriptData.scriptId;
      setScriptId(newScriptId);

      // 2. Deploy the script as a web app
      const deployResponse = await fetch(`https://script.googleapis.com/v1/projects/${newScriptId}/deployments`, {
          method: 'POST',
          headers: {
              'Authorization': `Bearer ${token.access_token}`,
              'Content-Type': 'application/json',
          },
          body: JSON.stringify({
              versionNumber: 1,
              manifestFileName: "appsscript",
              description: "Live deployment for Sheets-Slack Alerter"
          }),
      });
      if (!deployResponse.ok) throw new Error(`스크립트 배포 실패: ${await deployResponse.text()}`);
      const deployData = await deployResponse.json();
      const newDeploymentUrl = deployData.entryPoints.find((e: any) => e.entryPointType === 'WEB_APP').webApp.url;

      setDeploymentUrl(newDeploymentUrl);
      localStorage.setItem('scriptId', newScriptId);
      localStorage.setItem('deploymentUrl', newDeploymentUrl);
      setStatus('INSTALLED');

    } catch (e: any) {
      setError(`설치 실패: ${e.message}`);
      setStatus('ERROR');
    }
  };

  const handleAddRule = async (sheetUrl: string, sheetName: string, column: string, webhookUrl: string) => {
    if (!deploymentUrl || !token) return;
    setError(null);
    try {
      const params = new URLSearchParams({ action: 'add', sheetUrl, sheetName, column, webhookUrl });
      const response = await fetch(`${deploymentUrl}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token.access_token}` },
      });
      const text = await response.text();
      const result: GApiResponse<{ triggerId: string }> = JSON.parse(text);

      if (result.status === 'success') {
        fetchRules(); // Refresh list
      } else {
        throw new Error(result.message || '규칙 추가에 실패했습니다.');
      }
    } catch (e: any) {
      setError(`규칙 추가 오류: ${e.message}`);
    }
  };

  const handleDeleteRule = async (triggerId: string) => {
    if (!deploymentUrl || !token) return;
    setError(null);
    try {
      const params = new URLSearchParams({ action: 'delete', triggerId });
      const response = await fetch(`${deploymentUrl}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token.access_token}` },
      });
      const text = await response.text();
      const result: GApiResponse<null> = JSON.parse(text);

      if (result.status === 'success') {
        setRules(prev => prev.filter(r => r.triggerId !== triggerId));
      } else {
        throw new Error(result.message || '규칙 삭제에 실패했습니다.');
      }
    } catch (e: any) {
      setError(`규칙 삭제 오류: ${e.message}`);
    }
  };


  // --- RENDER LOGIC ---

  const renderContent = () => {
    switch (status) {
      case 'INITIAL':
        return <div className="text-center text-slate-500">초기화 중...</div>;

      case 'LOGGED_OUT':
        return (
          <div className="text-center">
            <h2 className="text-2xl font-bold text-slate-800 mb-2">환영합니다!</h2>
            <p className="text-slate-600 mb-6">시작하려면 Google 계정으로 로그인하세요.</p>
            <button
              onClick={handleLogin}
              className="inline-flex items-center justify-center bg-white px-6 py-3 border border-slate-300 rounded-md shadow-sm text-base font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <GoogleIcon />
              Google 계정으로 로그인
            </button>
          </div>
        );

      case 'LOGGED_IN':
        return (
          <div className="text-center">
            <h2 className="text-2xl font-bold text-slate-800 mb-2">설치 준비 완료</h2>
            <p className="text-slate-600 mb-6 max-w-xl mx-auto">아래 버튼을 클릭하여 알리미 봇을 당신의 Google 계정에 설치하세요. 이 설정은 한 번만 하면 됩니다.</p>
            <p className="text-xs text-slate-500 mb-6 max-w-md mx-auto">이 과정은 당신의 계정에 새로운 Google Apps Script 프로젝트를 생성하며, 이 웹사이트는 해당 스크립트와 통신합니다. 당신의 데이터는 어디에도 저장되지 않습니다.</p>
            <button
              onClick={handleInstallBot}
              className="bg-emerald-600 text-white font-bold py-3 px-8 rounded-md hover:bg-emerald-700 transition-colors"
            >
              알리미 봇 설치하기
            </button>
          </div>
        );
      
      case 'INSTALLING':
        return (
          <div className="text-center space-y-4">
            <svg className="animate-spin h-10 w-10 text-emerald-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <h2 className="text-2xl font-bold text-slate-800">알리미 봇 설치 중...</h2>
            <p className="text-slate-600">잠시만 기다려주세요. 이 창을 닫지 마세요.</p>
          </div>
        );

      case 'INSTALLED':
        return <RuleManager rules={rules} onAddRule={handleAddRule} onDeleteRule={handleDeleteRule} isLoading={isLoadingRules} />;
        
      case 'ERROR':
        return (
            <div className="text-center bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md">
                <strong className="font-bold">오류가 발생했습니다</strong>
                <p className="block sm:inline">{error}</p>
                <button onClick={handleLogout} className="mt-4 bg-red-500 text-white font-bold py-2 px-4 rounded">
                    로그아웃 후 다시 시도
                </button>
            </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <Header userEmail={user?.email} onLogout={handleLogout}/>
      <main className="container mx-auto p-4 sm:p-8">
        {error && status !== 'ERROR' && (
             <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md mb-6 relative" role="alert">
                <strong className="font-bold">오류: </strong>
                <span className="block sm:inline">{error}</span>
                <button onClick={() => setError(null)} className="absolute top-0 bottom-0 right-0 px-4 py-3">
                    <svg className="fill-current h-6 w-6 text-red-500" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>닫기</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/></svg>
                </button>
            </div>
        )}
        <div className="max-w-4xl mx-auto">
            {renderContent()}
        </div>
      </main>
      <footer className="text-center py-4 text-xs text-slate-400">
        <p>이 애플리케이션은 서버 없이 작동합니다. 모든 로직은 당신의 브라우저와 Google 계정 내에서만 실행됩니다.</p>
      </footer>
    </div>
  );
};

export default App;