use std::env;

#[derive(Clone, Debug)]
pub struct Settings {
    pub host: String,
    pub port: u16,
    pub database_url: String,
}

impl Settings {
    pub fn load() -> Self {
        let host = env::var("HOST").unwrap_or_else(|_| "0.0.0.0".into());
        let port = env::var("PORT").ok().and_then(|v| v.parse().ok()).unwrap_or(3030);
        let database_url = env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite:./quicktalk.sqlite".into());
        Settings { host, port, database_url }
    }
}
