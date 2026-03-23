import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import nodemailer from 'nodemailer';
import { Parser } from 'json2csv';
import archiver from 'archiver';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-dev';

// Setup Nodemailer Transporter
let transporter: nodemailer.Transporter;
nodemailer.createTestAccount().then(account => {
  transporter = nodemailer.createTransport({
    host: account.smtp.host,
    port: account.smtp.port,
    secure: account.smtp.secure,
    auth: {
      user: account.user,
      pass: account.pass,
    },
  });
  console.log('Nodemailer test account ready. Ethereal URL will be logged on email send.');
}).catch(console.error);

// Initialize SQLite database
const db = new Database('crm.db');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    source TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Penny Stocks',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
  );
`);

// Helper to log activities
function logActivity(leadId: number, action: string, details: string = '') {
  try {
    db.prepare('INSERT INTO activity_logs (lead_id, action, details) VALUES (?, ?, ?)').run(leadId, action, details);
  } catch (err) {
    console.error('Failed to log activity:', err);
  }
}

// Seed admin if not exists
const adminCount = db.prepare('SELECT COUNT(*) as count FROM admins').get() as { count: number };
if (adminCount.count === 0) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)').run('admin', hash);
}

// Seed some leads if empty
const leadCount = db.prepare('SELECT COUNT(*) as count FROM leads').get() as { count: number };
if (leadCount.count === 0) {
  const insertLead = db.prepare('INSERT INTO leads (name, email, source, status, notes) VALUES (?, ?, ?, ?, ?)');
  const res1 = insertLead.run('Alice Smith', 'alice@example.com', 'Website Form', 'Penny Stocks', 'Interested in premium plan.');
  logActivity(res1.lastInsertRowid as number, 'Created', 'Prospect created from Website Form');
  
  const res2 = insertLead.run('Bob Johnson', 'bob@example.com', 'Referral', 'IPO', 'Waiting for callback next week.');
  logActivity(res2.lastInsertRowid as number, 'Created', 'Prospect created from Referral');
  logActivity(res2.lastInsertRowid as number, 'Status Changed', 'Status updated to IPO');
  
  const res3 = insertLead.run('Charlie Brown', 'charlie@example.com', 'Direct Outreach', 'Master of the Universe', 'Signed contract on Monday.');
  logActivity(res3.lastInsertRowid as number, 'Created', 'Prospect created from Direct Outreach');
  logActivity(res3.lastInsertRowid as number, 'Status Changed', 'Status updated to Master of the Universe');
}

async function startServer() {
  const app = express();
  
  app.use(express.json());
  app.use(cors());

  // API Routes
  const apiRouter = express.Router();

  // Auth Route
  apiRouter.post('/auth/login', (req, res) => {
    const { username, password } = req.body;
    try {
      const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username) as any;
      if (!admin) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      const valid = bcrypt.compareSync(password, admin.password_hash);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign({ id: admin.id, username: admin.username }, JWT_SECRET, { expiresIn: '24h' });
      res.json({ token, username: admin.username });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  apiRouter.post('/auth/signup', (req, res) => {
    const { username, password } = req.body;
    try {
      const existing = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
      if (existing) {
        return res.status(400).json({ error: 'Username already exists' });
      }
      
      const hash = bcrypt.hashSync(password, 10);
      db.prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)').run(username, hash);
      
      res.status(201).json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Middleware to verify JWT
  const authenticate = (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });
    
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      next();
    } catch (err) {
      res.status(401).json({ error: 'Invalid token' });
    }
  };

  // Leads Routes
  apiRouter.get('/leads/export', authenticate, (req, res) => {
    try {
      const leads = db.prepare('SELECT * FROM leads ORDER BY created_at DESC').all();
      const fields = ['id', 'name', 'email', 'source', 'status', 'notes', 'created_at'];
      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(leads);
      
      res.header('Content-Type', 'text/csv');
      res.attachment('leads_report.csv');
      return res.send(csv);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to export leads' });
    }
  });

  apiRouter.get('/leads', authenticate, (req, res) => {
    try {
      const leads = db.prepare('SELECT * FROM leads ORDER BY created_at DESC').all();
      res.json(leads);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch leads' });
    }
  });

  apiRouter.post('/leads', authenticate, async (req, res) => {
    const { name, email, source, status, notes } = req.body;
    try {
      const result = db.prepare('INSERT INTO leads (name, email, source, status, notes) VALUES (?, ?, ?, ?, ?)').run(
        name, email, source, status || 'Penny Stocks', notes || ''
      );
      const newLeadId = result.lastInsertRowid as number;
      const newLead = db.prepare('SELECT * FROM leads WHERE id = ?').get(newLeadId);
      
      logActivity(newLeadId, 'Created', `Prospect created from ${source}`);

      // Send automated email
      if (transporter) {
        const mailOptions = {
          from: '"Mini CRM" <noreply@minicrm.com>',
          to: email,
          subject: 'Thank you for reaching out!',
          text: `Hi ${name},\n\nThank you for reaching out to us. We have received your information and will be in touch shortly.\n\nBest regards,\nThe Team`,
          html: `<p>Hi ${name},</p><p>Thank you for reaching out to us. We have received your information and will be in touch shortly.</p><p>Best regards,<br/>The Team</p>`
        };
        transporter.sendMail(mailOptions, (err, info) => {
          if (err) {
            console.error('Error sending email:', err);
          } else {
            console.log('Automated email sent. Preview URL:', nodemailer.getTestMessageUrl(info));
            logActivity(newLeadId, 'Email Sent', 'Automated welcome email sent');
          }
        });
      }

      res.status(201).json(newLead);
    } catch (err) {
      res.status(500).json({ error: 'Failed to create lead' });
    }
  });

  apiRouter.get('/leads/:id/activities', authenticate, (req, res) => {
    const { id } = req.params;
    try {
      const activities = db.prepare('SELECT * FROM activity_logs WHERE lead_id = ? ORDER BY created_at DESC').all(id);
      res.json(activities);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch activities' });
    }
  });

  apiRouter.put('/leads/:id/status', authenticate, (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
      const oldLead = db.prepare('SELECT status FROM leads WHERE id = ?').get(id) as any;
      db.prepare('UPDATE leads SET status = ? WHERE id = ?').run(status, id);
      const updatedLead = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
      
      if (oldLead && oldLead.status !== status) {
        logActivity(Number(id), 'Status Changed', `Status updated from ${oldLead.status} to ${status}`);
      }
      
      res.json(updatedLead);
    } catch (err) {
      res.status(500).json({ error: 'Failed to update status' });
    }
  });

  apiRouter.put('/leads/:id/notes', authenticate, (req, res) => {
    const { id } = req.params;
    const { notes } = req.body;
    try {
      db.prepare('UPDATE leads SET notes = ? WHERE id = ?').run(notes, id);
      const updatedLead = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
      
      logActivity(Number(id), 'Notes Updated', 'Prospect notes were updated');
      
      res.json(updatedLead);
    } catch (err) {
      res.status(500).json({ error: 'Failed to update notes' });
    }
  });

  apiRouter.delete('/leads/:id', authenticate, (req, res) => {
    const { id } = req.params;
    try {
      db.prepare('DELETE FROM leads WHERE id = ?').run(id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete lead' });
    }
  });

  apiRouter.get('/analytics', authenticate, (req, res) => {
    try {
      const total = db.prepare('SELECT COUNT(*) as count FROM leads').get() as { count: number };
      const newLeads = db.prepare('SELECT COUNT(*) as count FROM leads WHERE status = ?').get('Penny Stocks') as { count: number };
      const contacted = db.prepare('SELECT COUNT(*) as count FROM leads WHERE status = ?').get('IPO') as { count: number };
      const converted = db.prepare('SELECT COUNT(*) as count FROM leads WHERE status = ?').get('Master of the Universe') as { count: number };
      
      res.json({
        total: total.count,
        new: newLeads.count,
        contacted: contacted.count,
        converted: converted.count,
        conversionRate: total.count > 0 ? ((converted.count / total.count) * 100).toFixed(1) : 0
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch analytics' });
    }
  });

  apiRouter.get('/analytics/charts', authenticate, (req, res) => {
    try {
      // Leads by source
      const sourceData = db.prepare('SELECT source as name, COUNT(*) as value FROM leads GROUP BY source').all();
      
      // Leads over time (last 7 days)
      const timeData = db.prepare(`
        SELECT date(created_at) as date, COUNT(*) as count 
        FROM leads 
        GROUP BY date(created_at)
        ORDER BY date(created_at) ASC
        LIMIT 7
      `).all();

      // Conversion rates over the last 30 days
      const conversionData = db.prepare(`
        SELECT date(created_at) as date, 
               SUM(CASE WHEN status = 'Master of the Universe' THEN 1 ELSE 0 END) as converted,
               COUNT(*) as total
        FROM leads 
        WHERE created_at >= date('now', '-30 days')
        GROUP BY date(created_at)
        ORDER BY date(created_at) ASC
      `).all().map((row: any) => ({
        date: row.date,
        rate: row.total > 0 ? Math.round((row.converted / row.total) * 100) : 0,
        converted: row.converted,
        total: row.total
      }));

      res.json({ sourceData, timeData, conversionData });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch chart data' });
    }
  });

  apiRouter.get('/download-project', (req, res) => {
    try {
      res.attachment('project.zip');
      const archive = archiver('zip', {
        zlib: { level: 9 } // Sets the compression level.
      });

      archive.on('error', function(err) {
        res.status(500).send({ error: err.message });
      });

      archive.pipe(res);

      // Append files from the current directory, putting them inside a "task - 2" folder
      archive.glob('**/*', {
        cwd: process.cwd(),
        ignore: ['node_modules/**', 'dist/**', '.git/**', 'crm.db', 'crm.db-journal'],
        dot: true
      }, { prefix: 'project.1.0/task 2' });

      archive.finalize();
    } catch (err) {
      res.status(500).json({ error: 'Failed to generate zip' });
    }
  });

  app.use('/api', apiRouter);

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, '..', 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
