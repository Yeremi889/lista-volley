import { CONFIG } from './config.js';

const { createClient } = supabase;
const client = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

export const db = {
    // Leer si la lista está abierta o cerrada
    async getListStatus() {
        const { data } = await client.from('configuracion').select('lista_activa').single();
        return data ? data.lista_activa : false;
    },

    // Cambiar el estado (Abrir/Cerrar)
    async setListStatus(status) {
        await client.from('configuracion').update({ lista_activa: status }).eq('id', 1);
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
        await this.setListStatus(false); // Al borrar todo, cerramos la lista
    },

    subscribeToChanges(callback) {
        client.channel('custom-all-channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'jugadores' }, callback)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'configuracion' }, callback)
            .subscribe();
    }
};