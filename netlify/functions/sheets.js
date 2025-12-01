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
    console.log('Action:', action, 'Player:', playerName || 'none');

    // estado de jugadores
    if (action === 'getListStatusWithPlayers') {
      try {
        const result = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'A1:C30'
        });
        
        const values = result.data.values || [];
        let listaAbierta = false;
        let currentTimestamp = '';
        const players = [];
        
        for (let i = 0; i < values.length; i++) {
          const row = values[i];
          
          // Fila 1 (index 0): contiene A1, B1, C1
          if (i === 0) {
            // B1 es la columna 1 (0-based), C1 es columna 2
            if (row.length > 1) listaAbierta = row[1] === 'ABIERTA';
            if (row.length > 2) currentTimestamp = row[2] || '';
          }
          
          // Jugadores fila 5 (A5 es index 4)
          if (i >= 4 && row.length > 0 && row[0] && row[0].trim() !== '') {
            players.push(row[0].trim());
          }
        }
        
        const needsUpdate = !lastTimestamp || currentTimestamp !== lastTimestamp;
        
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          },
          body: JSON.stringify({ 
            listaAbierta, 
            needsUpdate,
            lastTimestamp: currentTimestamp,
            players: needsUpdate ? players : []
          })
        };
      } catch (error) {
        console.error('Error en getListStatusWithPlayers:', error.message);
        throw error;
      }
    }

    if (action === 'tryAddPlayer' && playerName) {
      try {
        //verificar estado y jugadores actuales
        const result = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'A1:C30'
        });
        
        const values = result.data.values || [];
        let listaAbierta = false;
        const currentPlayers = [];
        
        for (let i = 0; i < values.length; i++) {
          const row = values[i];
          
          if (i === 0 && row.length > 1) {
            listaAbierta = row[1] === 'ABIERTA';
          }
          
          if (i >= 4 && row.length > 0 && row[0] && row[0].trim() !== '') {
            currentPlayers.push(row[0].trim());
          }
        }
        
        // Validaciones
        if (!listaAbierta) {
          return { 
            statusCode: 400, 
            body: JSON.stringify({ error: 'Lista cerrada' }) 
          };
        }
        
        if (currentPlayers.includes(playerName.trim())) {
          return { 
            statusCode: 400, 
            body: JSON.stringify({ error: 'Ya existe' }) 
          };
        }
        
        // Determinar posición (jugadores o espera)
        const position = currentPlayers.length >= 12 ? 'espera' : 'jugadores';
        
        // Agregar jugador
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
        
        return {
          statusCode: 200,
          body: JSON.stringify({ 
            success: true,
            position: position,
            message: position === 'espera' ? 'Agregado a lista de espera' : 'Agregado a jugadores'
          })
        };
      } catch (error) {
        console.error('Error en tryAddPlayer:', error);
        throw error;
      }
    }

    // 3. REMOVE PLAYER
    if (action === 'removePlayer' && playerName) {
      try {
        const result = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: 'A5:A100'
        });
        
        const currentPlayers = result.data.values 
          ? result.data.values
              .filter(row => row[0] && row[0].trim() !== '')
              .map(row => row[0].trim())
          : [];
        
        // Verifica que el jugador existe
        if (!currentPlayers.includes(playerName.trim())) {
          return { 
            statusCode: 400, 
            body: JSON.stringify({ error: 'Jugador no encontrado' }) 
          };
        }
        
        // Filtrar el jugador a eliminar
        const updatedPlayers = currentPlayers.filter(
          name => name.toLowerCase() !== playerName.trim().toLowerCase()
        );
        
        await sheets.spreadsheets.values.clear({
          spreadsheetId: SPREADSHEET_ID,
          range: 'A5:A100'
        });
        
        // actualizar jugadores
        if (updatedPlayers.length > 0) {
          const values = updatedPlayers.map(name => [name]);
          await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: 'A5:A' + (4 + updatedPlayers.length),
            valueInputOption: 'RAW',
            requestBody: { values }
          });
        }
        
        // Actualiza timestamp
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
          body: JSON.stringify({ 
            success: true,
            message: 'Jugador eliminado correctamente'
          })
        };
      } catch (error) {
        console.error('Error en removePlayer:', error);
        throw error;
      }
    }

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

    if (action === 'getPlayers') {
      const result = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'A5:A100'
      });
      
      const players = result.data.values 
        ? result.data.values
            .filter(row => row[0] && row[0].trim() !== '')
            .map(row => row[0].trim())
        : [];
        
      return {
        statusCode: 200,
        body: JSON.stringify({ players })
      };
    }

    if (action === 'getListStatus') {
      const result = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'B1:B1'
      });
      
      const listaAbierta = result.data.values && 
                          result.data.values[0] && 
                          result.data.values[0][0] === 'ABIERTA';
      
      return {
        statusCode: 200,
        body: JSON.stringify({ listaAbierta })
      };
    }

    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Acción no válida' })
    };

  } catch (error) {
    console.error('ERROR DETALLADO:', {
      message: error.message,
      code: error.code,
      action: JSON.parse(event.body || '{}').action
    });
    
    // Manejo de errores
    if (error.message && error.message.includes('Quota exceeded')) {
      return {
        statusCode: 429,
        body: JSON.stringify({ 
          error: 'Límite temporal excedido',
          message: 'Por favor espera unos segundos'
        })
      };
    }
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Error del servidor',
        details: error.message 
      })
    };
  }
};