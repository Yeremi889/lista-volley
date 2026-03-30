const { createClient } = supabase;

const supabaseUrl = 'https://qbrenmwhxhwunsybohap.supabase.co';
const supabaseKey = 'sb_publishable_8YocspSidsOEdNj6bBdAxg_nisCbb2d';

export const client = createClient(supabaseUrl, supabaseKey);