import { CONFIG } from './config.js';

const { createClient } = supabase;
const client = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

export function getDeviceId() {
    let deviceId = localStorage.getItem('voley_device_id');
    if (!deviceId) {
        deviceId = 'dev_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
        localStorage.setItem('voley_device_id', deviceId);
    }
    return deviceId;
}

export const db = {
    async getListStatus() {
        try {
            const { data, error } = await client
                .from('configuracion')
                .select('lista_activa')
                .eq('id', 1)
                .single();
            if (error) throw error;
            return data ? data.lista_activa : false;
        } catch (e) {
            console.error("Error al leer estado:", e);
            return false;
        }
    },

    async setListStatus(status) {
        const { error } = await client
            .from('configuracion')
            .update({ lista_activa: status })
            .eq('id', 1);
        if (error) console.error("Error al actualizar estado:", error);
    },

    async fetchPlayers() {
        const { data } = await client
            .from('jugadores')
            .select('*')
            .order('created_at', { ascending: true });
        return data || [];
    },

    async getLastPlayerTimeByDevice() {
        const deviceId = getDeviceId();
        const { data, error } = await client
            .from('jugadores')
            .select('created_at')
            .eq('device_id', deviceId)
            .order('created_at', { ascending: false })
            .limit(1);

        if (error || !data || data.length === 0) return null;
        return data[0].created_at;
    },

    // Obtiene el último nombre con el que se anotó este dispositivo
    async getMyLastName() {
        const deviceId = getDeviceId();
        const { data } = await client
            .from('jugadores')
            .select('nombre')
            .eq('device_id', deviceId)
            .order('created_at', { ascending: false })
            .limit(1);
        
        return (data && data.length > 0) ? data[0].nombre : null;
    },

    async addPlayer(nombre) {
        const deviceId = getDeviceId();
        await client.from('jugadores').insert([{ nombre, device_id: deviceId }]);
        await this.addHistory(`${nombre} se anotó en la lista.`, 'info');
    },

    async removePlayer(id) {
        await client.from('jugadores').delete().eq('id', id);
    },

     // Se borra el historial al crear nueva lista
    async clearTable() {
        await client.from('jugadores').delete().neq('id', 0);
        await client.from('historial').delete().neq('id', 0);
        await this.setListStatus(false);
    },

    // Funciones del historial
    async addHistory(mensaje, tipo = 'info') {
        await client.from('historial').insert([{ mensaje, tipo }]);
    },

    async fetchHistory() {
        const { data } = await client
            .from('historial')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);
        return data || [];
    },

    subscribeToChanges(onPlayersChange, onConfigChange, onHistoryChange) {
        return client.channel('voley-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'jugadores' }, onPlayersChange)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'configuracion' }, onConfigChange)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'historial' }, onHistoryChange)
            .subscribe();
    }
};