const { google } = require('googleapis');

exports.handler = async function(event, context) {
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

  try {
    const { action, playerName } = JSON.parse(event.body || '{}');

    // Control de estado de lista (celda B1)
    if (action === 'getListStatus') {
      const result = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'B1:B1'
      });
      
      const listaAbierta = result.data.values && result.data.values[0] && result.data.values[0][0] === 'ABIERTA';
      
      return {
        statusCode: 200,
        body: JSON.stringify({ listaAbierta })
      };
    }

    if (action === 'openList') {
      // Marcar lista como abierta
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: 'B1:B1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [['ABIERTA']]
        }
      });

      return {
        statusCode: 200,
        body: JSON.stringify({ success: true })
      };
    }

    if (action === 'closeList') {
      // Marcar lista como cerrada y limpiar jugadores
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: 'B1:B1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [['CERRADA']]
        }
      });

      // Limpiar jugadores
      await sheets.spreadsheets.values.clear({
        spreadsheetId: SPREADSHEET_ID,
        range: 'A5:A100'
      });

      return {
        statusCode: 200,
        body: JSON.stringify({ success: true })
      };
    }

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