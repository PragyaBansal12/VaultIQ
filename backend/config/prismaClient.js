require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

// Get the database URL and remove ?sslmode=require to avoid conflict
// We handle SSL manually via the ssl option below
const rawUrl = process.env.DATABASE_URL || '';
const connectionString = rawUrl.replace('?sslmode=require', '').replace('&sslmode=require', '');

// Create a PostgreSQL connection pool
// rejectUnauthorized: false accepts Aiven's self-signed certificate chain
const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Create the Prisma driver adapter (required by Prisma v7)
const adapter = new PrismaPg(pool);

// Single shared PrismaClient instance — imported everywhere
const prisma = new PrismaClient({ adapter });

module.exports = prisma;