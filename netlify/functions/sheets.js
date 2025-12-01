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

    const { action, playerName, lastTimestamp, currentPlayers } = JSON.parse(event.body || '{}');
    console.log('Action:', action);

    // 1. GET LIST STATUS WITH PLAYERS (combo)
    if (action === 'getListStatusWithPlayers') {
      const [statusResult, timestampResult, playersResult] = await Promise.all([
        sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'B1:B1'
        }),
        sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'C1:C1'
        }),
        sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'A5:A30'
        })
      ]);
      
      const listaAbierta = statusResult.data.values && 
                          statusResult.data.values[0] && 
                          statusResult.data.values[0][0] === 'ABIERTA';
      
      const currentTimestamp = timestampResult.data.values && 
                              timestampResult.data.values[0] && 
                              timestampResult.data.values[0][0];
      
      const players = playersResult.data.values 
        ? playersResult.data.values.filter(row => row[0]).map(row => row[0])
        : [];
      
      const needsUpdate = !lastTimestamp || currentTimestamp !== lastTimestamp;
      
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          listaAbierta, 
          needsUpdate,
          lastTimestamp: currentTimestamp,
          players: needsUpdate ? players : []
        })
      };
    }

    // 2. TRY ADD PLAYER (con verificación en tiempo real)
    if (action === 'tryAddPlayer' && playerName) {
      // Obtener estado actual REAL
      const [currentData, statusResult] = await Promise.all([
        sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'A5:A30'
        }),
        sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'B1:B1'
        })
      ]);
      
      const currentPlayersList = currentData.data.values 
        ? currentData.data.values.filter(row => row[0]).map(row => row[0])
        : [];
      
      const listaAbierta = statusResult.data.values && 
                          statusResult.data.values[0] && 
                          statusResult.data.values[0][0] === 'ABIERTA';
      
      if (!listaAbierta) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Lista cerrada' }) };
      }
      
      if (currentPlayersList.includes(playerName)) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Ya existe' }) };
      }
      
      // Verificar si hay espacio (primeros 12)
      if (currentPlayersList.length >= 12) {
        // Agregar a lista de espera
        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: 'A5:A100',
          valueInputOption: 'RAW',
          requestBody: {
            values: [[playerName]]
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
        
        return { statusCode: 200, body: JSON.stringify({ 
          success: true,
          message: 'Lista llena - Agregado a espera'
        }) };
      }
      
      // Hay espacio, agregar normalmente
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'A5:A100',
        valueInputOption: 'RAW',
        requestBody: {
          values: [[playerName]]
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
      
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    // 3. OPEN LIST
    if (action === 'openList') {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: 'B1:B1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [['ABIERTA']]
        }
      });

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

    // 4. CLOSE LIST
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

    // 5. REMOVE PLAYER (pendiente de implementar completamente)
    if (action === 'removePlayer' && playerName) {
      // Implementación básica por ahora
      const result = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'A5:A100'
      });
      
      const currentPlayers = result.data.values 
        ? result.data.values.filter(row => row[0]).map(row => row[0])
        : [];

      const updatedPlayers = currentPlayers.filter(name => name !== playerName);

      // Limpiar y reescribir
      await sheets.spreadsheets.values.clear({
        spreadsheetId: SPREADSHEET_ID,
        range: 'A5:A100'
      });

      if (updatedPlayers.length > 0) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: 'A5:A' + (4 + updatedPlayers.length),
          valueInputOption: 'RAW',
          requestBody: {
            values: updatedPlayers.map(name => [name])
          }
        });
      }

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