import { createClient } from '@supabase/supabase-js';

// Bun loads .env automatically


const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const createAdmin = async () => {
    const email = 'admin@amore.com';
    const password = 'admin123';

    console.log(`Creating user: ${email}`);

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
    });

    if (error) {
        console.error('Error creating user:', error.message);
    } else {
        console.log('User created successfully:', data.user?.email);
        console.log('User ID:', data.user?.id);

        if (data.session) {
            console.log('Session active. User is logged in/confirmed.');
        } else {
            console.log('Check your email to confirm the account (if email confirmation is enabled).');
        }
    }
};

createAdmin();
