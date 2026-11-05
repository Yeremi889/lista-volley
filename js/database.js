import { CONFIG } from './config.js';

const client = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

async function rpc(name, params) {
    const { data, error } = await client.rpc(name, params);
    if (error) throw error;
    return data;
}

async function select(query) {
    const { data, error } = await query;
    if (error) throw error;
    return data;
}

export const db = {
    // La sesión anónima identifica al dispositivo sin pedir cuenta ni correo.
    async ensureSession() {
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        if (data.session) return;

        const { error: signInError } = await client.auth.signInAnonymously();
        if (signInError) throw signInError;
    },

    async fetchState() {
        const [config, players, history] = await Promise.all([
            select(client.from('configuracion').select('lista_activa').eq('id', 1).single()),
            select(client.from('jugadores').select('id, nombre, created_at').order('created_at', { ascending: true })),
            select(client.from('historial').select('*').order('created_at', { ascending: false }).limit(20))
        ]);

        return { isActive: config.lista_activa, players, history };
    },

    getCooldown: () => rpc('segundos_espera'),
    isAdmin: () => rpc('es_admin'),
    openList: (password) => rpc('abrir_lista', { p_password: password }),
    addPlayer: (nombre) => rpc('anotar_jugador', { p_nombre: nombre }),
    removePlayer: (id) => rpc('quitar_jugador', { p_id: String(id) }),
    newList: () => rpc('nueva_lista'),

    subscribeToChanges(onChange, onConnected) {
        return client.channel('voley-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'jugadores' }, onChange)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'configuracion' }, onChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'historial' }, onChange)
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') onConnected();
            });
    }
};
