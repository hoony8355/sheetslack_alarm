// 중요: 이 값은 Google Cloud Console에서 생성한 실제 OAuth 2.0 클라이언트 ID로 교체해야 합니다.
// Google Cloud 프로젝트(ID: salckalarm)의 'API 및 서비스' > '사용자 인증 정보'에서
// 'OAuth 2.0 클라이언트 ID'를 생성하고, '승인된 자바스크립트 원본'에
// 이 웹사이트의 주소(https://hoony8355.github.io/sheetslack_alarm)를 추가해야 합니다.
export const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLOUD_PROJECT_CLIENT_ID'; 

export const SCRIPT_TITLE = "원클릭-스프레드시트-슬랙-알리미-봇";

export const GOOGLE_API_SCOPES = [
    "https://www.googleapis.com/auth/script.projects",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/script.deployments"
].join(" ");

export const ALERTER_APPS_SCRIPT_CODE = `
const SCRIPT_PROPERTIES = PropertiesService.getScriptProperties();

function sendJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  try {
    const action = e.parameter.action;
    
    if (!action) {
      return sendJsonResponse({ status: 'error', message: '작업이 지정되지 않았습니다.' });
    }

    switch(action) {
      case 'list':
        return listRules();
      case 'add':
        return addRule(e.parameter);
      case 'delete':
        return deleteRule(e.parameter);
      default:
        return sendJsonResponse({ status: 'error', message: '알 수 없는 작업: ' + action });
    }
  } catch (error) {
    return sendJsonResponse({ status: 'error', message: error.message, stack: error.stack });
  }
}

function handleEdit(e) {
  try {
    const range = e.range;
    const sheet = range.getSheet();
    const spreadsheet = sheet.getParent();
    const editedCol = range.getColumn();

    const triggerId = e.triggerUid;
    const webhookUrl = SCRIPT_PROPERTIES.getProperty('webhook_' + triggerId);
    const watchCol = SCRIPT_PROPERTIES.getProperty('column_' + triggerId);
    
    if (webhookUrl && watchCol && parseInt(watchCol, 10) === editedCol) {
      const editedRow = range.getRow();
      const cellValue = range.getValue();
      const sheetName = sheet.getName();
      const spreadsheetName = spreadsheet.getName();
      
      const payload = {
        text: \`🔔 *시트 알림!*\\n\\n*시트*: \${spreadsheetName} (\${sheetName})\\n*셀*: \${range.getA1Notation()}\\n*새 값*: \${cellValue}\`
      };
      
      const options = {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload)
      };
      
      UrlFetchApp.fetch(webhookUrl, options);
    }
  } catch (err) {
    // 사용자가 모든 수정에 대해 오류 이메일을 받지 않도록 조용히 실패 처리합니다.
    console.error("수정 트리거 처리 실패: " + err.toString());
  }
}

function listRules() {
    const triggers = ScriptApp.getProjectTriggers();
    const rules = triggers.map(trigger => {
        if (trigger.getEventType() !== ScriptApp.EventType.ON_EDIT) return null;
        const triggerId = trigger.getUniqueId();
        const spreadsheetId = trigger.getTriggerSourceId();
        if (spreadsheetId) {
            return {
                triggerId: triggerId,
                spreadsheetId: spreadsheetId,
                spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/' + spreadsheetId + '/',
                sheetName: SCRIPT_PROPERTIES.getProperty('sheetName_' + triggerId) || 'N/A',
                column: SCRIPT_PROPERTIES.getProperty('column_' + triggerId) || 'N/A',
                webhookUrl: SCRIPT_PROPERTIES.getProperty('webhook_' + triggerId) || 'N/A',
            };
        }
        return null;
    }).filter(Boolean);

    return sendJsonResponse({ status: 'success', data: rules });
}


function addRule(params) {
  const { sheetUrl, sheetName, column, webhookUrl } = params;
  
  if (!sheetUrl || !sheetName || !column || !webhookUrl) {
    throw new Error('규칙 추가에 필요한 매개변수가 없습니다.');
  }

  const spreadsheet = SpreadsheetApp.openByUrl(sheetUrl);
  const sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error('스프레드시트에서 "' + sheetName + '" 시트를 찾을 수 없습니다.');
  }

  const trigger = ScriptApp.newTrigger('handleEdit')
    .forSpreadsheet(spreadsheet)
    .onEdit()
    .create();

  const triggerId = trigger.getUniqueId();
  
  SCRIPT_PROPERTIES.setProperty('webhook_' + triggerId, webhookUrl);
  SCRIPT_PROPERTIES.setProperty('column_' + triggerId, column);
  SCRIPT_PROPERTIES.setProperty('sheetName_' + triggerId, sheetName);
  
  return sendJsonResponse({ status: 'success', message: '규칙이 성공적으로 추가되었습니다!', data: { triggerId: triggerId } });
}

function deleteRule(params) {
  const { triggerId } = params;

  if (!triggerId) {
    throw new Error('규칙 삭제에 필요한 triggerId가 없습니다.');
  }

  const triggers = ScriptApp.getProjectTriggers();
  let triggerFound = false;

  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getUniqueId() === triggerId) {
      ScriptApp.deleteTrigger(triggers[i]);
      triggerFound = true;
      break;
    }
  }

  if (!triggerFound) {
    // 삭제 실패한 이전 트리거일 수 있으므로, 속성만 정리합니다.
    console.log("삭제할 트리거 " + triggerId + "를 찾지 못했지만, 관련 속성을 정리합니다.");
  }
  
  SCRIPT_PROPERTIES.deleteProperty('webhook_' + triggerId);
  SCRIPT_PROPERTIES.deleteProperty('column_' + triggerId);
  SCRIPT_PROPERTIES.deleteProperty('sheetName_' + triggerId);
  
  return sendJsonResponse({ status: 'success', message: '규칙이 성공적으로 삭제되었습니다!' });
}
`;