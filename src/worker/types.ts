export type Env = {
    gpa_db: D1Database;
    ASSETS: Fetcher;
    BREVO_API_KEY: string;
    BREVO_SENDER_EMAIL: string;
    FORMSPREE_URL?: string;
    TURNSTILE_SECRET_KEY?: string;
};

export type UserRow = {
    id: string;
    name: string;
    roll: string;
    email: string | null;
};

export type Variables = {
    user: UserRow;
};

export type AppContext = {
    Bindings: Env;
    Variables: Variables;
};