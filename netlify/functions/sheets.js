// En sheets.js, agregar esta acción:
if (action === 'tryAddPlayer' && playerName && currentPlayers !== undefined) {
  // 1. Obtener estado ACTUAL (no el cacheado)
  const [currentData, statusResult] = await Promise.all([
    sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'A5:A100'
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
  
  // 2. Verificar si ya existe
  if (currentPlayersList.includes(playerName)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Ya existe' }) };
  }
  
  // 3. Verificar si hay campo (primeros 12)
  if (currentPlayersList.length >= 12) {
    // Solo agregar a lista de espera
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
      message: 'Agregado a lista de espera' 
    }) };
  }
  
  // 4. Si hay campo, agregar
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

// Y esta acción combo:
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
      range: 'A5:A30' // 12 jugadores + 18 espera
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