
export interface Rule {
  triggerId: string;
  spreadsheetId: string;
  spreadsheetUrl: string;
  sheetName: string;
  column: string;
  webhookUrl: string;
}

export interface GApiResponse<T> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
}

export type AppStatus = 
  | 'INITIAL'
  | 'LOGGED_OUT'
  | 'LOGGED_IN'
  | 'INSTALLING'
  | 'INSTALLED'
  | 'ERROR';

// Fix: Add GoogleTokenResponse interface to define the shape of the Google Auth token object.
export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  error?: string;
  error_description?: string;
  error_uri?: string;
}
