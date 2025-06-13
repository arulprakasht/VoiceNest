// server/app.js - Enhanced Server with Real Vapi Integration
const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const VapiService = require('./vapi_integration');

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
//Arul




//Arul

//

// Initialize Vapi service with error handling
let vapiService;
try {
    vapiService = new VapiService();
} catch (error) {
    console.error('Failed to initialize Vapi service:', error.message);
}

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: [
            "'self'", 
            "wss://api.vapi.ai", 
            "https://api.vapi.ai",
        /*    "ws://localhost:*", // for development*/
            "wss://*.vapi.ai"
        ],
        scriptSrc: [
            "'self'", 
            "'unsafe-inline'", 
            "'unsafe-eval'",
            "https://unpkg.com",
            "https://cdn.jsdelivr.net"
        ],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        // ... rest of your CSP
    }
    }
}));

// Rate limiting - more lenient for voice calls
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: NODE_ENV === 'production' ? 100 : 1000,
    message: { 
        success: false, 
        error: 'Too many requests, please try again later.' 
    }
});

const callLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // Allow more calls for voice functionality
    message: { 
        success: false, 
        error: 'Too many call attempts, please wait a moment.' 
    }
});

app.use('/api/', generalLimiter);


app.use('/api/vapi/call', callLimiter);


// CORS configuration
const corsOptions = {
    origin: NODE_ENV === 'production' 
        ? process.env.ALLOWED_ORIGINS?.split(',') || false
        : true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../client')));

// Enhanced Supabase client (keeping your existing implementation)
const { createClient } = require('@supabase/supabase-js');
let supabase;

try {
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
        supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY,
            {
                auth: { persistSession: false },
                db: { schema: 'public' }
            }
        );
        console.log('Supabase client initialized successfully');
    }
} catch (error) {
    console.error('Failed to initialize Supabase:', error.message);
}

// Request logging middleware
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
    });
    next();
});

// Service availability middleware
const checkServices = (req, res, next) => {
    req.services = {
        vapi: !!vapiService,
        supabase: !!supabase
    };
    next();
};

app.use('/api', checkServices);

// Routes

// Enhanced health check
app.get('/api/health', async (req, res) => {
    const health = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        services: {}
    };

    // Check Vapi service
    if (vapiService) {
        try {
            const vapiHealth = await vapiService.healthCheck();
            health.services.vapi = vapiHealth;
        } catch (error) {
            health.services.vapi = { status: 'error', message: error.message };
        }
    } else {
        health.services.vapi = { status: 'unavailable', message: 'Service not initialized' };
    }

    // Check Supabase
    if (supabase) {
        try {
            const { error } = await supabase.from('properties').select('count', { count: 'exact', head: true });
            health.services.supabase = error 
                ? { status: 'error', message: error.message }
                : { status: 'healthy' };
        } catch (error) {
            health.services.supabase = { status: 'error', message: 'Connection failed' };
        }
    } else {
        health.services.supabase = { status: 'unavailable', message: 'Service not initialized' };
    }

    const overallHealthy = Object.values(health.services).some(service => 
        service.status === 'healthy' || service.status === 'OK'
    );

    res.status(overallHealthy ? 200 : 503).json(health);
});

// Property search endpoint (keeping your existing implementation)
app.post('/api/search', async (req, res) => {
    if (!supabase) {
        return res.status(503).json({
            success: false,
            error: 'Database service unavailable'
        });
    }

    try {
        const { criteria } = req.body;
        
        if (!criteria || typeof criteria !== 'object') {
            return res.status(400).json({
                success: false,
                error: 'Invalid search criteria'
            });
        }

        const { minPrice, maxPrice, bedrooms, bathrooms, city, state, propertyType } = criteria;

        // Input validation
        const errors = [];
        if (minPrice !== undefined && (isNaN(minPrice) || minPrice < 0)) {
            errors.push('Invalid minimum price');
        }
        if (maxPrice !== undefined && (isNaN(maxPrice) || maxPrice < 0)) {
            errors.push('Invalid maximum price');
        }
        if (bedrooms !== undefined && (isNaN(bedrooms) || bedrooms < 0 || bedrooms > 10)) {
            errors.push('Invalid number of bedrooms');
        }
        if (bathrooms !== undefined && (isNaN(bathrooms) || bathrooms < 0 || bathrooms > 20)) {
            errors.push('Invalid number of bathrooms');
        }

        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors
            });
        }

        // Build query
        let query = supabase.from('properties').select('*');

        if (minPrice !== undefined) query = query.gte('price', minPrice);
        if (maxPrice !== undefined) query = query.lte('price', maxPrice);
        if (bedrooms !== undefined) query = query.eq('bedrooms', bedrooms);
        if (bathrooms !== undefined) query = query.eq('bathrooms', bathrooms);
        if (city) query = query.ilike('city', `%${city}%`);
        if (state) query = query.ilike('state', `%${state}%`);
        if (propertyType) query = query.eq('property_type', propertyType);

        const { data, error } = await query.limit(100);

        if (error) {
            console.error('Database query error:', error);
            return res.status(500).json({
                success: false,
                error: 'Search failed'
            });
        }

        res.json({
            success: true,
            properties: data || [],
            count: data?.length || 0
        });

    } catch (error) {
        console.error('Search endpoint error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
//Test-don't leave it for folks to claim money

/*
app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is working' });
});
*/


// Enhanced Vapi endpoints

// Get assistant info
app.get('/api/vapi/assistant', async (req, res) => {
    if (!vapiService) {
        return res.status(503).json({
            success: false,
            error: 'Vapi service unavailable'
        });
    }

    try {
        const assistant = await vapiService.getAssistant();
        res.json({
            success: true,
            data: assistant
        });

    } catch (error) {
        console.error('Get assistant error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get assistant info'
        });
    }
});

// Create phone call
app.post('/api/vapi/call/phone', async (req, res) => {
    if (!vapiService) {
        return res.status(503).json({
            success: false,
            error: 'Vapi service unavailable'
        });
    }

    try {
        const { phoneNumber, assistantId } = req.body;

        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                error: 'Phone number is required'
            });
        }

        const result = await vapiService.makeCall(phoneNumber, assistantId);
        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('Phone call error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to make phone call'
        });
    }
});

// Create web call
app.post('/api/vapi/call', async (req, res) => {
    if (!vapiService) {
        return res.status(503).json({
            success: false,
            error: 'Vapi service unavailable'
        });
    }
    
    try {
        const { assistantId } = req.body;
        
        // Always use WebSocket transport configuration
        const transport = {
            provider: "vapi.websocket",
            audioFormat: {
                format: "pcm_s16le",
                container: "raw",
                sampleRate: 16000
            }
        };
        
        console.log('Creating web call with config:', { 
            assistantId: assistantId || vapiService.assistantId,
            transportProvider: transport.provider,
            audioFormat: transport.audioFormat
        });
        
        const result = await vapiService.createWebCall(assistantId, transport);
        
        if (!result || !result.id || !result.transport || !result.transport.websocketCallUrl) {
            throw new Error('Invalid response from Vapi service');
        }
        
        // Send back only what's needed for the frontend
        return res.json({
            success: true,
            data: {
                id: result.id,
                transport: {
                    provider: result.transport.provider,
                    websocketCallUrl: result.transport.websocketCallUrl
                },
                publicKey: result.publicKey
            }
        });
        
    } catch (error) {
        console.error('Failed to create web call:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get all calls
app.get('/api/vapi/calls', async (req, res) => {
    if (!vapiService) {
        return res.status(503).json({
            success: false,
            error: 'Vapi service unavailable'
        });
    }

    try {
        const { limit = 50, offset = 0 } = req.query;
        const calls = await vapiService.getCalls(parseInt(limit), parseInt(offset));
        
        res.json({
            success: true,
            data: calls
        });

    } catch (error) {
        console.error('Get calls error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to retrieve calls'
        });
    }
});

// Get specific call
app.get('/api/vapi/calls/:callId', async (req, res) => {
    if (!vapiService) {
        return res.status(503).json({
            success: false,
            error: 'Vapi service unavailable'
        });
    }

    try {
        const { callId } = req.params;
        const call = await vapiService.getCall(callId);
        
        res.json({
            success: true,
            data: call
        });

    } catch (error) {
        console.error('Get call error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get call details'
        });
    }
});

// End call
app.delete('/api/vapi/calls/:callId', async (req, res) => {
    if (!vapiService) {
        return res.status(503).json({
            success: false,
            error: 'Vapi service unavailable'
        });
    }

    try {
        const { callId } = req.params;
        const result = await vapiService.endCall(callId);
        
        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('End call error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to end call'
        });
    }
});

// Get call transcript
app.get('/api/vapi/calls/:callId/transcript', async (req, res) => {
    if (!vapiService) {
        return res.status(503).json({
            success: false,
            error: 'Vapi service unavailable'
        });
    }

    try {
        const { callId } = req.params;
        const transcript = await vapiService.getCallTranscript(callId);
        
        res.json({
            success: true,
            data: { transcript }
        });

    } catch (error) {
        console.error('Get transcript error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get transcript'
        });
    }
});

// Get VAPI configuration (public key for frontend)
app.get('/api/vapi/config', (req, res) => {
    if (!vapiService) {
        return res.status(503).json({
            success: false,
            error: 'Vapi service unavailable'
        });
    }

    // Only send what's absolutely necessary for frontend
    res.json({
        success: true,
        publicKey: vapiService.publicKey,
        assistantId: vapiService.assistantId
    });
});

// Serve static files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: NODE_ENV === 'production' ? 'Internal server error' : err.message
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route not found'
    });
});

// Global error handlers
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Start server
const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} in ${NODE_ENV} mode`);
    console.log(`Services available:`, {
        vapi: !!vapiService,
        supabase: !!supabase
    });
    
    if (vapiService) {
        console.log('Vapi Assistant ID:', process.env.VAPI_ASSISTANT_ID);
    }
});

// Handle server errors
server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use`);
        process.exit(1);
    } else {
        console.error('Server error:', error);
        process.exit(1);
    }
});

// Graceful shutdown
const gracefulShutdown = () => {
    console.log('Shutting down gracefully...');
    server.close(() => {
        if (vapiService) {
            vapiService.destroy();
        }
        console.log('Process terminated');
        process.exit(0);
    });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Webhook endpoint for Vapi status updates
app.post('/api/vapi/webhook', express.json(), async (req, res) => {
    try {
        const { type, data } = req.body;
        console.log('Received webhook:', type, data);

        if (!type || !data) {
            return res.status(400).json({
                success: false,
                error: 'Invalid webhook payload'
            });
        }

        switch (type) {
            case 'status-update':
                if (data.callId) {
                    console.log(`Call ${data.callId} status updated to: ${data.status}`);
                }
                break;
            case 'transcript':
                if (data.callId && data.transcript) {
                    console.log(`New transcript for call ${data.callId}:`, data.transcript);
                }
                break;
            case 'call-ended':
                if (data.callId) {
                    console.log(`Call ${data.callId} ended`);
                }
                break;
            case 'speech-update':
                console.log('Speech update:', data);
                break;
            case 'conversation-update':
                console.log('Conversation update:', data);
                break;
            case 'end-of-call-report':
                console.log('End of call report:', data);
                break;
            default:
                console.log('Unhandled webhook type:', type, data);
        }

        // Always return 200 to acknowledge receipt
        res.json({ success: true });

    } catch (error) {
        console.error('Webhook error:', error);
        // Still return 200 to prevent retries
        res.json({ 
            success: false,
            error: error.message 
        });
    }
});

module.exports = app;
