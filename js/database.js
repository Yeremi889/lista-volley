import { client } from './supabase.js';

export const db = {
    // Traer jugadores
    async getPlayers() {
        const { data, error } = await client
            .from('jugadores')
            .select('*')
            .order('created_at', { ascending: true });
        if (error) throw error;
        return data;
    },

    // Añadir jugador
    async addPlayer(nombre) {
        const { data, error } = await client
            .from('jugadores')
            .insert([{ nombre }]);
        if (error) throw error;
        return data;
    },

    // Quitar un jugador
    async removePlayer(id) {
        const { error } = await client
            .from('jugadores')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },

    // Nueva Lista
    async clearTable() {
        // En Supabase, para borrar todo sin filtro, usamos un truco:
        const { error } = await client
            .from('jugadores')
            .delete()
            .neq('id', 0); 
        if (error) throw error;
    },

    // REALTIME
    subscribeToChanges(callback) {
        return client
            .channel('custom-all-channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'jugadores' }, callback)
            .subscribe();
    }
};