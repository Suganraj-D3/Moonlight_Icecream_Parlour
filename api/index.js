require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const app = reportMissingDbUrlOrGetApp();

function reportMissingDbUrlOrGetApp() {
    if (!process.env.DATABASE_URL) {
        console.error('\n==================================================');
        console.error('CRITICAL ERROR: DATABASE_URL environment variable is missing.');
        console.error('The application requires a PostgreSQL database in production and local modes.');
        console.error('Please configure the DATABASE_URL in your .env or platform settings.');
        console.error('==================================================\n');
        process.exit(1);
    }
    return express();
}

const PORT = process.env.PORT || 3000;
const PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'; // Default admin password

app.use(cors());
app.use(express.json());

// Database Driver Setup (Direct connection to Neon Postgres)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Neon requires SSL configuration
    }
});

// Database Initialization (DDL Schema Setup & Seed)
async function initDb() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // 1. Create menu table
        await client.query(`
            CREATE TABLE IF NOT EXISTS menu (
                id INT PRIMARY KEY,
                data JSONB NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Seed default menu from local menu.json if database is completely fresh
        const menuCheck = await client.query('SELECT 1 FROM menu WHERE id = 1');
        if (menuCheck.rowCount === 0) {
            console.log('Seeding database with default menu...');
            const defaultMenuPath = path.join(__dirname, '..', 'menu.json');
            if (fs.existsSync(defaultMenuPath)) {
                try {
                    const defaultMenu = JSON.parse(fs.readFileSync(defaultMenuPath, 'utf8'));
                    await client.query(
                        'INSERT INTO menu (id, data) VALUES (1, $1)',
                        [defaultMenu]
                    );
                    console.log('Default menu seeded successfully.');
                } catch (err) {
                    console.error('Failed to parse or seed default menu.json:', err);
                }
            } else {
                console.warn('default menu.json not found to seed database.');
            }
        }

        // 2. Create sales_summary table
        await client.query(`
            CREATE TABLE IF NOT EXISTS sales_summary (
                id SERIAL PRIMARY KEY,
                table_name VARCHAR(100),
                timestamp VARCHAR(100),
                items JSONB NOT NULL,
                total NUMERIC(10, 2) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 3. Create sales_endings table
        await client.query(`
            CREATE TABLE IF NOT EXISTS sales_endings (
                id SERIAL PRIMARY KEY,
                timestamp BIGINT NOT NULL,
                total NUMERIC(10, 2) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await client.query('COMMIT');
        console.log('PostgreSQL database schemas verified/created.');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Failed to initialize database tables:', e);
        throw e;
    } finally {
        client.release();
    }
}

// Database Initialization Middleware for Serverless Environment
let dbInitialized = false;
app.use(async (req, res, next) => {
    if (!dbInitialized) {
        try {
            await initDb();
            dbInitialized = true;
        } catch (err) {
            console.error('Error during database initialization:', err);
        }
    }
    next();
});

// Database Access Layer Helpers
async function getMenu() {
    const result = await pool.query('SELECT data FROM menu WHERE id = 1');
    return result.rows.length > 0 ? result.rows[0].data : { sections: [] };
}

async function saveMenu(newMenu) {
    await pool.query(
        'INSERT INTO menu (id, data, updated_at) VALUES (1, $1, NOW()) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()',
        [newMenu]
    );
}

async function getSales() {
    const result = await pool.query('SELECT table_name AS table, timestamp, items, total FROM sales_summary ORDER BY created_at ASC');
    return result.rows.map(row => ({
        ...row,
        total: Number(row.total)
    }));
}

async function addSale(txn) {
    await pool.query(
        'INSERT INTO sales_summary (table_name, timestamp, items, total) VALUES ($1, $2, $3, $4)',
        [txn.table || 'Unknown', txn.timestamp, JSON.stringify(txn.items), txn.total]
    );
}

async function clearSales() {
    await pool.query('DELETE FROM sales_summary');
}

async function deleteSale(timestamp) {
    await pool.query('DELETE FROM sales_summary WHERE timestamp = $1', [timestamp]);
}

async function getEndings() {
    const result = await pool.query('SELECT timestamp, total FROM sales_endings ORDER BY created_at ASC');
    return result.rows.map(row => ({
        timestamp: Number(row.timestamp),
        total: Number(row.total)
    }));
}

async function addEnding(record) {
    await pool.query(
        'INSERT INTO sales_endings (timestamp, total) VALUES ($1, $2)',
        [record.timestamp, record.total]
    );
}

async function clearEndings() {
    await pool.query('DELETE FROM sales_endings');
}

// DYNAMIC SCRIPT GENERATION ROUTES (Preserves HTML Compatibility)
app.get('/menu.js', async (req, res) => {
    try {
        const menuData = await getMenu();
        res.type('application/javascript');
        res.send(`// Auto-generated by Express Server\nconst menuData = ${JSON.stringify(menuData, null, 2)};\n`);
    } catch (e) {
        console.error('Error generating menu.js:', e);
        res.status(500).send('console.error("Failed to load menu.js dynamically from DB");');
    }
});

app.get('/sales_summary.js', async (req, res) => {
    try {
        const sales = await getSales();
        res.type('application/javascript');
        res.send(`// Auto-generated by Express Server\nconst salesSummaryData = ${JSON.stringify(sales, null, 2)};\n`);
    } catch (e) {
        console.error('Error generating sales_summary.js:', e);
        res.status(500).send('console.error("Failed to load sales_summary.js dynamically from DB");');
    }
});

app.get('/sales_endings.js', async (req, res) => {
    try {
        const endings = await getEndings();
        res.type('application/javascript');
        res.send(`// Auto-generated by Express Server\nconst salesEndingsData = ${JSON.stringify(endings, null, 2)};\n`);
    } catch (e) {
        console.error('Error generating sales_endings.js:', e);
        res.status(500).send('console.error("Failed to load sales_endings.js dynamically from DB");');
    }
});

// API ENDPOINTS

// Login Endpoint
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === PASSWORD) {
        return res.json({ success: true, token: 'moonlight-session-token-9988' });
    } else {
        return res.status(401).json({ success: false, message: 'Invalid Password' });
    }
});

// Get Menu Endpoint
app.get('/api/menu', async (req, res) => {
    try {
        const menu = await getMenu();
        res.json(menu);
    } catch (e) {
        console.error('GET /api/menu failed:', e);
        res.status(500).json({ error: 'Failed to read menu data' });
    }
});

// Save Menu Endpoint
app.post('/api/menu', async (req, res) => {
    const token = req.headers['authorization'];
    if (token !== 'Bearer moonlight-session-token-9988') {
        return res.status(403).json({ error: 'Unauthorized access' });
    }

    const newMenu = req.body;
    if (!newMenu || !Array.isArray(newMenu.sections)) {
        return res.status(400).json({ error: 'Invalid menu data format' });
    }

    try {
        await saveMenu(newMenu);
        console.log('Menu saved successfully.');
        res.json({ success: true, message: 'Menu saved and synced successfully' });
    } catch (e) {
        console.error('POST /api/menu failed:', e);
        res.status(500).json({ error: 'Failed to save menu data' });
    }
});

// GET Sales Summary
app.get('/api/sales', async (req, res) => {
    try {
        const sales = await getSales();
        res.json(sales);
    } catch (e) {
        console.error('GET /api/sales failed:', e);
        res.status(500).json({ error: 'Failed to read sales summary' });
    }
});

// POST new transaction
app.post('/api/sales', async (req, res) => {
    const txn = req.body;
    try {
        await addSale(txn);
        res.json({ success: true, message: 'Transaction saved' });
    } catch (e) {
        console.error('POST /api/sales failed:', e);
        res.status(500).json({ error: 'Failed to write sales summary' });
    }
});

// Clear Sales Summary
app.post('/api/sales/clear', async (req, res) => {
    try {
        await clearSales();
        res.json({ success: true, message: 'Sales summary cleared' });
    } catch (e) {
        console.error('POST /api/sales/clear failed:', e);
        res.status(500).json({ error: 'Failed to clear sales summary' });
    }
});

// Delete a specific transaction
app.post('/api/sales/delete', async (req, res) => {
    const { timestamp } = req.body;
    try {
        await deleteSale(timestamp);
        res.json({ success: true, message: 'Transaction deleted' });
    } catch (e) {
        console.error('POST /api/sales/delete failed:', e);
        res.status(500).json({ error: 'Failed to delete transaction' });
    }
});

// GET Sales Endings
app.get('/api/sales/end', async (req, res) => {
    try {
        const endings = await getEndings();
        res.json(endings);
    } catch (e) {
        console.error('GET /api/sales/end failed:', e);
        res.status(500).json({ error: 'Failed to read sales endings' });
    }
});

// POST new sales ending
app.post('/api/sales/end', async (req, res) => {
    const record = req.body;
    try {
        await addEnding(record);
        res.json({ success: true, message: 'Sales endings saved' });
    } catch (e) {
        console.error('POST /api/sales/end failed:', e);
        res.status(500).json({ error: 'Failed to write sales endings' });
    }
});

// Clear Sales Endings
app.post('/api/sales/end/clear', async (req, res) => {
    try {
        await clearEndings();
        res.json({ success: true, message: 'Sales endings cleared' });
    } catch (e) {
        console.error('POST /api/sales/end/clear failed:', e);
        res.status(500).json({ error: 'Failed to clear sales endings' });
    }
});

// Serve static files of the parlour & SPA fallback when running locally (non-Vercel)
if (process.env.VERCEL !== '1') {
    app.use(express.static(path.join(__dirname, '..')));

    // Fallback to index.html for undefined routes
    app.get('*all', (req, res) => {
        res.sendFile(path.join(__dirname, '..', 'index.html'));
    });

    app.listen(PORT, () => {
        console.log('\n==================================================');
        console.log(`Moonlight Icecream Parlour Server is running locally!`);
        console.log(`Access the application at: http://localhost:${PORT}`);
        console.log(`Admin Password: ${PASSWORD}`);
        console.log('==================================================\n');
    });
}

module.exports = app;
