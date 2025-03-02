import mysql from 'mysql2/promise';

export async function getConnection() {
  return await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    database: process.env.MYSQL_DATABASE,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    ssl: {
      rejectUnauthorized: false
    }
  });
}

export async function executeQuery(query: string, params: any[] = []) {
  try {
    const connection = await getConnection();
    const [results] = await connection.execute(query, params);
    await connection.end();
    return results;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
} 