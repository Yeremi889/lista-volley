const { google } = require('googleapis');

exports.handler = async function(event, context) {
  console.log('=== SHEETS FUNCTION STARTED ===');
  
  try {
    console.log('1. Verificando variables de entorno...');
    console.log('GOOGLE_PROJECT_ID:', process.env.GOOGLE_PROJECT_ID ? '✅ Existe' : '❌ Faltante');
    console.log('GOOGLE_PRIVATE_KEY_ID:', process.env.GOOGLE_PRIVATE_KEY_ID ? '✅ Existe' : '❌ Faltante');
    console.log('GOOGLE_CLIENT_EMAIL:', process.env.GOOGLE_CLIENT_EMAIL ? '✅ Existe' : '❌ Faltante');
    console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? '✅ Existe' : '❌ Faltante');
    console.log('GOOGLE_PRIVATE_KEY length:', process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.length : '❌ Faltante');

    // Verificar que todas las variables existen
    if (!process.env.GOOGLE_PROJECT_ID || !process.env.GOOGLE_PRIVATE_KEY_ID || 
        !process.env.GOOGLE_PRIVATE_KEY || !process.env.GOOGLE_CLIENT_EMAIL || 
        !process.env.GOOGLE_CLIENT_ID) {
      throw new Error('Faltan variables de entorno requeridas');
    }

    console.log('2. Configurando autenticación...');
    const auth = new google.auth.GoogleAuth({
      credentials: {
        type: "service_account",
        project_id: process.env.GOOGLE_PROJECT_ID,
        private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        client_id: process.env.GOOGLE_CLIENT_ID,
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    console.log('3. Creando cliente de Sheets...');
    const sheets = google.sheets({ version: 'v4', auth });
    const SPREADSHEET_ID = '1C-fmkU-RPFzkEd834U4Zb8yJ0CyD0YhhNsJDK1_iziM';

    console.log('4. Parseando request body...');
    const { action, playerName } = JSON.parse(event.body || '{}');
    console.log('Action recibida:', action);

    // Control de estado de lista (celda B1)
    if (action === 'getListStatus') {
      console.log('5. Ejecutando getListStatus...');
      const result = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'B1:B1'
      });
      
      console.log('6. Resultado de getListStatus:', result.data);
      const listaAbierta = result.data.values && result.data.values[0] && result.data.values[0][0] === 'ABIERTA';
      
      return {
        statusCode: 200,
        body: JSON.stringify({ listaAbierta })
      };
    }

    // ... (el resto de las acciones permanecen igual)
    if (action === 'openList') {
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
    console.error('=== ERROR DETALLADO ===');
    console.error('Mensaje:', error.message);
    console.error('Stack:', error.stack);
    console.error('Tipo:', error.name);
    
    // Verificar si es error de autenticación
    if (error.message.includes('invalid_grant') || error.message.includes('unauthorized_client')) {
      console.error('ERROR: Problema de autenticación con Google Service Account');
    }
    
    if (error.message.includes('notFound')) {
      console.error('ERROR: Spreadsheet no encontrada - verifica el ID o los permisos');
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Error del servidor',
        message: error.message,
        type: error.name
      })
    };
  }
};