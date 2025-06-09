
// server/vapi_integration.js - Real Vapi.ai Integration
const https = require('https');
const { EventEmitter } = require('events');


class VapiService extends EventEmitter {
// In your VapiService constructor, update this section:
constructor() {
    super();
    
    // Use PRIVATE key for backend API operations
    this.privateKey = process.env.VAPI_PRIVATE_KEY;
    
    // Use PUBLIC key for frontend/web integration
    this.publicKey = process.env.VAPI_PUBLIC_KEY;
    
    // For backend API calls, use private key
    this.apiKey = this.privateKey;
    
    this.assistantId = process.env.VAPI_ASSISTANT_ID;
    this.baseUrl = 'api.vapi.ai';
    this.initialized = false;
    
    this.validateConfig();
    this.initialize();
}

// Update validation
validateConfig() {
    if (!this.privateKey) {
        console.warn('VAPI_PRIVATE_KEY not found in environment variables');
        return false;
    }

    if (!this.publicKey) {
        console.warn('VAPI_PUBLIC_KEY not found in environment variables');
        return false;
    }

    if (!this.assistantId) {
        console.warn('VAPI_ASSISTANT_ID not found in environment variables');
        return false;
    }

    return true;
}

    async initialize() {
        try {
            if (!this.validateConfig()) {
                throw new Error('Vapi configuration incomplete');
            }
            
            this.initialized = true;
            this.emit('ready');
            console.log('VapiService initialized successfully');
        } catch (error) {
            console.error('Failed to initialize VapiService:', error.message);
            this.emit('error', error);
        }
    }

    async healthCheck() {
        try {
            if (!this.initialized) {
                return { status: 'initializing' };
            }

            // Test API connection with assistant endpoint
            const assistantData = await this.getAssistant();
            
            return { 
                status: 'healthy',
                apiKeyPresent: !!this.apiKey,
                assistantId: this.assistantId,
                assistantName: assistantData?.name || 'Unknown'
            };
        } catch (error) {
            console.error('Health check failed:', error);
            return { status: 'error', message: error.message };
        }
    }

    // Make HTTP request helper
    makeRequest(options, data = null) {
        return new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let body = '';
                
                res.on('data', (chunk) => {
                    body += chunk;
                });
                
                res.on('end', () => {
                    try {
                        const response = JSON.parse(body);
                        
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(response);
                        } else {
                            reject(new Error(`API Error: ${res.statusCode} - ${response.message || body}`));
                        }
                    } catch (error) {
                        reject(new Error(`Parse Error: ${error.message}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(new Error(`Request Error: ${error.message}`));
            });

            if (data) {
                req.write(JSON.stringify(data));
            }
            
            req.end();
        });
    }

    // Get assistant details
    async getAssistant() {
        try {
            if (!this.assistantId) {
                throw new Error('Assistant ID not configured');
            }

            const options = {
                hostname: this.baseUrl,
                path: `/assistant/${this.assistantId}`,
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            };

            return await this.makeRequest(options);

        } catch (error) {
            console.error('Get assistant error:', error);
            throw error;
        }
    }

    // Create a phone call
    async makeCall(phoneNumber, customAssistantId = null) {
        try {
            if (!this.apiKey) {
                throw new Error('Vapi API key not configured');
            }

            if (!phoneNumber) {
                throw new Error('Phone number is required');
            }

            // Validate and format phone number
            const cleanPhone = phoneNumber.replace(/[\s\-\(\)]/g, '');
            const phoneRegex = /^\+?[1-9]\d{8,14}$/;
            
            if (!phoneRegex.test(cleanPhone)) {
                throw new Error('Invalid phone number format. Use international format (+1234567890)');
            }

            const callData = {
                assistantId: customAssistantId || this.assistantId,
                phoneNumberId: null, // Use default phone number from Vapi
                customer: {
                    number: cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone}`
                }
            };

            const options = {
                hostname: this.baseUrl,
                path: '/call/phone',
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            };

            const result = await this.makeRequest(options, callData);
            
            console.log(`Call initiated successfully:`, result.id);
            return result;

        } catch (error) {
            console.error('Make call error:', error);
            throw error;
        }
    }

    
    // Create a web call (for browser integration)
/*
    async createWebCall(customAssistantId = null) {
//AP
        console.log('Request payload:', JSON.stringify(payload, null, 2));
        try {
            if (!this.apiKey) {
                throw new Error('Vapi API key not configured');
            }

            const callData = {
                assistantId: customAssistantId || this.assistantId,
                type: 'web'
            };

            const options = {
                hostname: this.baseUrl,
                path: '/call/web',
                method: 'POST',
                headers: {
               //AP     'Authorization': `Bearer ${this.apiKey}`,
               'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            };

            const result = await this.makeRequest(options, callData);
            
            console.log(`Web call created successfully:`, result.id);
            return result;

        } catch (error) {
            console.error('Create web call error:', error);
            throw error;
        }
    }
AP BAD*/
// For createWebCall, you might want to return the public key for frontend use


async createWebCall(customAssistantId = null) {
    try {
        if (!this.privateKey) {
            throw new Error('Vapi private key not configured');
        }

        const callData = {
            assistantId: customAssistantId || this.assistantId
        };

        console.log('Request payload:', JSON.stringify(callData, null, 2));

        const options = {
            hostname: this.baseUrl,
            path: '/call/web',
            method: 'POST',
            headers: {
     //AP
     //            'Authorization': `Bearer ${this.privateKey}`, // Use private key for API calls
                'Authorization': `Bearer ${this.publicKey}`, // Use private key for API calls
           
     'Content-Type': 'application/json'
            }
        };

        const result = await this.makeRequest(options, callData);
        
        console.log(`Web call created successfully:`, result.id);
        
        // Return both the call data and public key for frontend
        return {
            ...result,
            publicKey: this.publicKey // Frontend needs this to connect
        };

    } catch (error) {
        console.error('Create web call error:', error);
        throw error;
    }
}


// Get all calls
//    async getCalls(limit = 100, offset = 0) {
      async getCalls(limit = 100) {

        try {
            if (!this.apiKey) {
                throw new Error('Vapi API key not configured');
            }

            const options = {
                hostname: this.baseUrl,
//                path: `/call?limit=${limit}&offset=${offset}`,
                path: `/call?limit=${limit}`,
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            };

            const result = await this.makeRequest(options);
            return result;

        } catch (error) {
            console.error('Get calls error:', error);
            throw error;
        }
    }

    
// Get specific call details
async getCall(callId) {
    try {
        if (!this.privateKey) {
            throw new Error('Vapi private key not configured');
        }

        if (!callId) {
            throw new Error('Call ID is required');
        }

        const options = {
            hostname: this.baseUrl,
            path: `/call/${callId}`,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${this.privateKey}`, // Use private key
                'Content-Type': 'application/json'
            }
        };

        return await this.makeRequest(options);

    } catch (error) {
        console.error('Get call error:', error);
        throw error;
    }
}
    // End an active call
    async endCall(callId) {
        try {
            if (!this.apiKey) {
                throw new Error('Vapi API key not configured');
            }

            if (!callId) {
                throw new Error('Call ID is required');
            }

            const options = {
                hostname: this.baseUrl,
                path: `/call/${callId}`,
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            };

            return await this.makeRequest(options);

        } catch (error) {
            console.error('End call error:', error);
            throw error;
        }
    }

    // Get call transcript
    async getCallTranscript(callId) {
        try {
            const call = await this.getCall(callId);
            return call.transcript || null;
        } catch (error) {
            console.error('Get transcript error:', error);
            throw error;
        }
    }

    // Update assistant (if needed)
    async updateAssistant(updates) {
        try {
            if (!this.assistantId) {
                throw new Error('Assistant ID not configured');
            }

            const options = {
                hostname: this.baseUrl,
                path: `/assistant/${this.assistantId}`,
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            };

            return await this.makeRequest(options, updates);

        } catch (error) {
            console.error('Update assistant error:', error);
            throw error;
        }
    }

    // Cleanup method
    destroy() {
        this.removeAllListeners();
        this.initialized = false;
    }
}

module.exports = VapiService;