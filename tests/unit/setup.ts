import "dotenv/config";

// Os testes rodam sempre no fuso da loja, para que regras de horário de corte sejam determinísticas.
process.env.TZ = "America/Sao_Paulo";
