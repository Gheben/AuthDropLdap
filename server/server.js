import express from "express";
import http from "http";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from 'url';
import cookieParser from "cookie-parser";
import database from "./database.js";
import apiRoutes from "./api-routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default class GBDropServer {

    constructor(port, conf) {
        this._conf = conf;
        const app = express();

        // Initialize database
        database.initialize().catch(err => {
            console.error('Failed to initialize database:', err);
            process.exit(1);
        });

        // Middleware
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));
        app.use(cookieParser());

        if (this._conf.rateLimit) {
            const limiter = rateLimit({
                windowMs: 5 * 60 * 1000, // 5 minutes
                max: this._conf.rateLimit
            });
            app.use(limiter);
            console.log(`Rate limit: ${this._conf.rateLimit} requests per 5 minutes`);
        } else {
            console.log("Rate limiting disabled.");
        }

        // API routes
        app.use('/api', apiRoutes);

        // Serve static files
        const publicPath = path.join(__dirname, '..', 'public');
        app.use(express.static(publicPath));

        // Serve HTML pages without .html extension
        app.get("/login", (_, res) => {
            res.sendFile(path.join(publicPath, 'login.html'));
        });

        app.get("/admin", (_, res) => {
            res.sendFile(path.join(publicPath, 'admin.html'));
        });

        // Endpoint to get rtc-config and buttons from env variable
        app.get("/config", (_, res) => {
            res.json({
                "rtcConfig": this._conf.rtcConfig || null,
                "buttons": this._conf.buttons || {}
            });
        });

        if (this._conf.debugMode) {
            // Serve index.html and all other files in debug mode
            app.get("/ip", (req, res) => {
                res.send({
                    ip: req.ip.replace(/^::ffff:/, '')
                });
            });

            // Redirect all other requests to index.html
            app.get("/*", (_, res) => {
                res.sendFile(path.join(publicPath, 'index.html'));
            });
        } else {
            // Redirect all other requests to index.html
            app.get("/*", (_, res) => {
                res.sendFile(path.join(publicPath, 'index.html'));
            });
        }

        this._server = http.createServer(app);
        this._server.listen(port, () => {
            console.log(`GBDrop is running on port ${port}`);
        });
    }

    getServer() {
        return this._server;
    }
}
