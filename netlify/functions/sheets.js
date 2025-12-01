const { google } = require('googleapis');

exports.handler = async function(event, context) {
  console.log('Function called:', new Date().toISOString());
  
  try {
    // Configurar auth
    const auth = new google.auth.GoogleAuth({
      credentials: {
        type: "service_account",
        project_id: process.env.GOOGLE_PROJECT_ID,
        private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        client_id: process.env.GOOGLE_CLIENT_ID,
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const SPREADSHEET_ID = '1C-fmkU-RPFzkEd834U4Zb8yJ0CyD0YhhNsJDK1_iziM';

    const { action, playerName, lastTimestamp } = JSON.parse(event.body || '{}');
    console.log('Action:', action, 'playerName:', playerName);

    // 1. OBTENER ESTADO CON TIMESTAMP
    if (action === 'getListStatusWithTimestamp') {
      const [statusResult, timestampResult] = await Promise.all([
        sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'B1:B1'
        }),
        sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'C1:C1' // Celda para timestamp
        })
      ]);
      
      const listaAbierta = statusResult.data.values && 
                          statusResult.data.values[0] && 
                          statusResult.data.values[0][0] === 'ABIERTA';
      
      const currentTimestamp = timestampResult.data.values && 
                              timestampResult.data.values[0] && 
                              timestampResult.data.values[0][0];
      
      // Verificar si hay cambios desde la última vez
      const needsUpdate = !lastTimestamp || currentTimestamp !== lastTimestamp;
      
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          listaAbierta, 
          needsUpdate,
          lastTimestamp: currentTimestamp 
        })
      };
    }

    // 2. ABRIR LISTA
    if (action === 'openList') {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: 'B1:B1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [['ABIERTA']]
        }
      });

      // Actualizar timestamp
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: 'C1:C1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [[new Date().toISOString()]]
        }
      });

      return {
        statusCode: 200,
        body: JSON.stringify({ success: true })
      };
    }

    // 3. CERRAR LISTA
    if (action === 'closeList') {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: 'B1:B1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [['CERRADA']]
        }
      });

      await sheets.spreadsheets.values.clear({
        spreadsheetId: SPREADSHEET_ID,
        range: 'A5:A100'
      });

      // Actualizar timestamp
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: 'C1:C1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [[new Date().toISOString()]]
        }
      });

      return {
        statusCode: 200,
        body: JSON.stringify({ success: true })
      };
    }

    // 4. OBTENER JUGADORES
    if (action === 'getPlayers') {
      const result = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'A5:A100'
      });
      
      const players = result.data.values 
        ? result.data.values.filter(row => row[0]).map(row => row[0])
        : [];
        
      return {
        statusCode: 200,
        body: JSON.stringify({ players })
      };
    }

    // 5. AÑADIR JUGADOR
    if (action === 'addPlayer' && playerName) {
      // Verificar si ya existe
      const currentData = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'A5:A100'
      });

      const currentPlayers = currentData.data.values 
        ? currentData.data.values.filter(row => row[0]).map(row => row[0])
        : [];

      if (currentPlayers.includes(playerName)) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Nombre ya existe' }) };
      }

      // Agregar nuevo jugador
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'A5:A100',
        valueInputOption: 'RAW',
        requestBody: {
          values: [[playerName]]
        }
      });

      // ACTUALIZAR TIMESTAMP (IMPORTANTE)
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: 'C1:C1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [[new Date().toISOString()]]
        }
      });

      return {
        statusCode: 200,
        body: JSON.stringify({ success: true })
      };
    }

    // 6. PING UPDATE (para forzar actualizaciones)
    if (action === 'pingUpdate') {
      // Solo actualizar timestamp
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: 'C1:C1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [[new Date().toISOString()]]
        }
      });

      return {
        statusCode: 200,
        body: JSON.stringify({ success: true })
      };
    }

    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Acción no válida' })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error del servidor' })
    };
  }
};