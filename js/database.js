import { CONFIG } from './config.js';

const { createClient } = supabase;
const client = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

export const db = {
    async getListStatus() {
        try {
            const { data, error } = await client.from('Configuracion').select('lista_activa').eq('id', 1).single();
            if (error) throw error;
            return data ? data.lista_activa : false;
        } catch (e) {
            console.error("Error al leer estado:", e);
            return false;
        }
    },

    async setListStatus(status) {
        const { error } = await client.from('Configuracion').update({ lista_activa: status }).eq('id', 1);
        if (error) console.error("Error al actualizar estado:", error);
    },

    async fetchPlayers() {
        const { data } = await client.from('jugadores').select('*').order('created_at', { ascending: true });
        return data || [];
    },

    async addPlayer(nombre) {
        await client.from('jugadores').insert([{ nombre }]);
    },

    async removePlayer(id) {
        await client.from('jugadores').delete().eq('id', id);
    },

    async clearTable() {
        await client.from('jugadores').delete().neq('id', 0);
        await this.setListStatus(false);
    },

    subscribeToChanges(onPlayersChange, onConfigChange) {
        client.channel('voley-channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'jugadores' }, onPlayersChange)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'Configuracion' }, onConfigChange)
            .subscribe();
    }
};