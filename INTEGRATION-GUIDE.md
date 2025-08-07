# 🎯 Private Markets Intelligence Agent - Integration Guide

## Overview

The **Private Markets Intelligence Agent** is a production-ready API service that provides AI-powered conversational access to private markets data. This enhanced wrapper service offers session-based conversations with memory, rich response formatting, and seamless integration capabilities for external applications.

### 🌐 **Live Service URL**
```
https://merry-creativity-production.up.railway.app
```

### ✨ **Key Features**
- 🧠 **Conversational Memory** - Sessions maintain context across multiple queries
- 💬 **Rich Responses** - Natural language + structured data + actionable suggestions  
- 📊 **Smart Visualizations** - Automatic chart and visualization recommendations
- ⚙️ **Session Management** - Full CRUD operations on user sessions
- 🎯 **Context-Aware Queries** - Follow-up questions understand previous context
- 🏢 **Multi-App Support** - Different applications can maintain separate sessions
- 💰 **Financial Data Formatting** - Professional formatting for AUM, rankings, and metrics

---

## 📋 Quick Start

### 1. **Basic Integration (Auto-Session)**
The simplest way to get started - no session management required:

```javascript
const response = await fetch('https://merry-creativity-production.up.railway.app/api/wrapper/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: "What are the top private equity firms?",
    userId: "user-123",
    context: {
      appId: "my-web-app"
    }
  })
});

const data = await response.json();
console.log(data.response.message); // Natural language response
console.log(data.sessionToken); // Save this for follow-up messages
```

### 2. **Advanced Integration (With Session Management)**
For full conversational experience with persistent memory:

```javascript
// Step 1: Create a session
const sessionResponse = await fetch('https://merry-creativity-production.up.railway.app/api/wrapper/session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user-123',
    appId: 'my-web-app',
    userPreferences: {
      responseFormat: 'conversational',
      includeCharts: true,
      maxResults: 5
    }
  })
});

const session = await sessionResponse.json();

// Step 2: Use session for conversations
const chatResponse = await fetch('https://merry-creativity-production.up.railway.app/api/wrapper/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'What are the largest private equity firms?',
    sessionToken: session.sessionToken,
    userId: 'user-123',
    context: { appId: 'my-web-app' }
  })
});

const chatData = await chatResponse.json();
```

---

## 🔗 API Endpoints

### **1. Enhanced Chat Endpoint**
**`POST /api/wrapper/chat`** - Main integration endpoint

#### Request Body:
```json
{
  "message": "What are the top private equity firms?",
  "sessionToken": "sess_1234567890_abcdef", // Optional - auto-created if not provided
  "userId": "user-123", // Optional but recommended
  "context": {
    "appId": "my-web-app",
    "userPreferences": {
      "responseFormat": "conversational", // "conversational", "structured", "brief"
      "includeCharts": true,
      "maxResults": 5
    }
  },
  "metadata": { // Optional
    "source": "web-chat",
    "timestamp": "2025-08-07T02:00:00Z"
  }
}
```

#### Response Format:
```json
{
  "success": true,
  "requestId": "req_1754532668435_z2yky7hgd",
  "timestamp": "2025-08-07T02:07:44.186Z",
  "sessionToken": "sess_1754532668435_z2yky7hgd",
  "response": {
    "type": "enhanced_chat",
    "message": "I found 5 relevant results for 'What are the top private equity firms?'. Blackstone leads with $991.0B in AUM, making it one of the world's largest asset managers. Together, these 5 firms manage $2.5T in assets.",
    "data": {
      "entities": [
        {
          "id": "1",
          "name": "Blackstone",
          "type": "Private Equity Firm",
          "aum": 991000000000,
          "aumFormatted": "$991.0B",
          "rank": 1,
          "location": "New York, USA",
          "highlight": "One of the world's largest asset managers"
        }
      ],
      "summary": {
        "totalResults": 5,
        "totalAUM": "$2.5T",
        "avgAUM": "$505.8B",
        "firms": 5
      }
    },
    "suggestions": [
      {
        "text": "Tell me more about Blackstone",
        "action": "detail_view",
        "entityId": "blackstone"
      },
      {
        "text": "Show portfolio companies",
        "action": "portfolio_view",
        "context": "private_equity"
      },
      {
        "text": "Compare with competitors",
        "action": "comparison",
        "entityType": "private_equity_firm"
      }
    ],
    "visualizations": [
      {
        "type": "bar_chart",
        "title": "Assets Under Management Comparison",
        "description": "Compare AUM across firms",
        "dataUrl": "/api/chart/aum-comparison/1754532668435",
        "suggestedHeight": 300
      }
    ]
  },
  "conversationContext": {
    "intent": "general_search",
    "entitiesDiscussed": ["blackstone", "kkr", "apollo global management", "carlyle group", "tpg"],
    "topicHistory": ["What are the top private equity firms?"],
    "lastQuery": "What are the top private equity firms?",
    "queryCount": 1
  },
  "metadata": {
    "processingTime": 245,
    "cached": false,
    "confidence": 0.95,
    "dataSource": "Private Markets Knowledge Store",
    "sessionAge": 1234,
    "deployment": "railway-wrapper"
  }
}
```

### **2. Session Management Endpoints**

#### **Create Session**
**`POST /api/wrapper/session`**

```json
{
  "userId": "user-123",
  "appId": "my-web-app",
  "userPreferences": {
    "responseFormat": "conversational",
    "includeCharts": true,
    "maxResults": 5
  }
}
```

Response:
```json
{
  "success": true,
  "sessionToken": "sess_1754532668435_z2yky7hgd",
  "expiresAt": "2025-08-08T02:07:44.186Z",
  "userPreferences": { /* preferences */ },
  "timestamp": "2025-08-07T02:07:44.186Z"
}
```

#### **Get Session Info**
**`GET /api/wrapper/session/{sessionToken}`**

Response:
```json
{
  "success": true,
  "sessionToken": "sess_1754532668435_z2yky7hgd",
  "userId": "user-123",
  "appId": "my-web-app",
  "totalQueries": 5,
  "entitiesDiscussed": ["blackstone", "kkr", "apollo"],
  "conversationLength": 3,
  "lastActivity": "2025-08-07T02:07:44.186Z",
  "userPreferences": { /* preferences */ }
}
```

#### **Delete Session**
**`DELETE /api/wrapper/session/{sessionToken}`**

### **3. Service Statistics**
**`GET /api/wrapper/stats`**

```json
{
  "success": true,
  "data": {
    "wrapper": {
      "version": "1.0.0",
      "deployment": "railway-integrated",
      "uptime": 1234.56,
      "sessions": {
        "totalActiveSessions": 15,
        "totalQueries": 127
      },
      "features": {
        "conversationMemory": true,
        "contextAwareQueries": true,
        "richResponses": true,
        "sessionManagement": true,
        "visualizationSuggestions": true
      }
    },
    "timestamp": "2025-08-07T02:07:44.186Z"
  }
}
```

---

## 💡 Integration Examples

### **React/JavaScript Integration**

```javascript
class PrivateMarketsChat {
  constructor(appId, userId) {
    this.baseUrl = 'https://merry-creativity-production.up.railway.app';
    this.appId = appId;
    this.userId = userId;
    this.sessionToken = null;
  }

  async initSession() {
    try {
      const response = await fetch(`${this.baseUrl}/api/wrapper/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: this.userId,
          appId: this.appId,
          userPreferences: {
            responseFormat: 'conversational',
            includeCharts: true,
            maxResults: 5
          }
        })
      });
      
      const data = await response.json();
      this.sessionToken = data.sessionToken;
      return data;
    } catch (error) {
      console.error('Session creation failed:', error);
      throw error;
    }
  }

  async sendMessage(message) {
    try {
      const response = await fetch(`${this.baseUrl}/api/wrapper/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          sessionToken: this.sessionToken,
          userId: this.userId,
          context: { appId: this.appId }
        })
      });

      const data = await response.json();
      
      if (data.success) {
        // Update session token
        this.sessionToken = data.sessionToken;
        
        return {
          message: data.response.message,
          entities: data.response.data.entities,
          suggestions: data.response.suggestions,
          visualizations: data.response.visualizations,
          conversationContext: data.conversationContext
        };
      } else {
        throw new Error(data.error.message);
      }
    } catch (error) {
      console.error('Chat message failed:', error);
      throw error;
    }
  }

  async getSessionInfo() {
    if (!this.sessionToken) return null;
    
    try {
      const response = await fetch(`${this.baseUrl}/api/wrapper/session/${this.sessionToken}`);
      return await response.json();
    } catch (error) {
      console.error('Failed to get session info:', error);
      return null;
    }
  }
}

// Usage Example
const chat = new PrivateMarketsChat('my-web-app', 'user-123');

// Initialize session
await chat.initSession();

// Send messages
const response1 = await chat.sendMessage('What are the top private equity firms?');
console.log('AI Response:', response1.message);
console.log('Suggestions:', response1.suggestions);

// Follow-up with context
const response2 = await chat.sendMessage('Tell me more about the first one');
console.log('Follow-up Response:', response2.message);
```

### **Python Integration**

```python
import requests
import json

class PrivateMarketsChat:
    def __init__(self, app_id, user_id):
        self.base_url = 'https://merry-creativity-production.up.railway.app'
        self.app_id = app_id
        self.user_id = user_id
        self.session_token = None
        
    def init_session(self):
        """Initialize a new session"""
        url = f"{self.base_url}/api/wrapper/session"
        payload = {
            "userId": self.user_id,
            "appId": self.app_id,
            "userPreferences": {
                "responseFormat": "conversational",
                "includeCharts": True,
                "maxResults": 5
            }
        }
        
        response = requests.post(url, json=payload)
        data = response.json()
        
        if data['success']:
            self.session_token = data['sessionToken']
            return data
        else:
            raise Exception(f"Session creation failed: {data.get('error')}")
    
    def send_message(self, message):
        """Send a chat message"""
        url = f"{self.base_url}/api/wrapper/chat"
        payload = {
            "message": message,
            "sessionToken": self.session_token,
            "userId": self.user_id,
            "context": {"appId": self.app_id}
        }
        
        response = requests.post(url, json=payload)
        data = response.json()
        
        if data['success']:
            # Update session token
            self.session_token = data['sessionToken']
            
            return {
                'message': data['response']['message'],
                'entities': data['response']['data']['entities'],
                'suggestions': data['response']['suggestions'],
                'visualizations': data['response']['visualizations'],
                'context': data['conversationContext']
            }
        else:
            raise Exception(f"Chat failed: {data.get('error')}")

# Usage
chat = PrivateMarketsChat('my-python-app', 'user-456')
chat.init_session()

# Send messages
response1 = chat.send_message('What are the largest private equity firms?')
print('AI Response:', response1['message'])

response2 = chat.send_message('Show me their portfolio companies')
print('Follow-up:', response2['message'])
```

---

## 🎨 UI Integration Patterns

### **Chat Interface Example (React)**

```jsx
import React, { useState, useEffect } from 'react';

const PrivateMarketsChat = ({ userId, appId }) => {
  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Initialize chat service
    const initChat = async () => {
      const chatInstance = new PrivateMarketsChat(appId, userId);
      await chatInstance.initSession();
      setChat(chatInstance);
    };
    
    initChat();
  }, [userId, appId]);

  const sendMessage = async () => {
    if (!inputMessage.trim() || !chat) return;

    const userMessage = { type: 'user', content: inputMessage };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await chat.sendMessage(inputMessage);
      
      const aiMessage = {
        type: 'ai',
        content: response.message,
        entities: response.entities,
        suggestions: response.suggestions,
        visualizations: response.visualizations
      };
      
      setMessages(prev => [...prev, aiMessage]);
      setInputMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage = {
        type: 'error',
        content: 'Sorry, I encountered an error. Please try again.'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = async (suggestion) => {
    setInputMessage(suggestion.text);
    await sendMessage();
  };

  return (
    <div className="chat-container">
      <div className="messages">
        {messages.map((message, index) => (
          <div key={index} className={`message ${message.type}`}>
            <div className="message-content">{message.content}</div>
            
            {/* Display entities */}
            {message.entities && (
              <div className="entities">
                <h4>Key Information:</h4>
                {message.entities.map(entity => (
                  <div key={entity.id} className="entity-card">
                    <strong>{entity.name}</strong>
                    {entity.aumFormatted && <span>AUM: {entity.aumFormatted}</span>}
                    {entity.highlight && <em>{entity.highlight}</em>}
                  </div>
                ))}
              </div>
            )}
            
            {/* Display suggestions */}
            {message.suggestions && (
              <div className="suggestions">
                {message.suggestions.map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="suggestion-btn"
                  >
                    {suggestion.text}
                  </button>
                ))}
              </div>
            )}
            
            {/* Display visualizations */}
            {message.visualizations && message.visualizations.length > 0 && (
              <div className="visualizations">
                <h4>Suggested Charts:</h4>
                {message.visualizations.map((viz, i) => (
                  <div key={i} className="viz-suggestion">
                    📊 {viz.title}: {viz.description}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      
      <div className="input-area">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Ask about private markets..."
          disabled={isLoading}
        />
        <button onClick={sendMessage} disabled={isLoading || !inputMessage.trim()}>
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
};

export default PrivateMarketsChat;
```

### **CSS Styling Example**

```css
.chat-container {
  max-width: 800px;
  margin: 0 auto;
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
}

.messages {
  height: 500px;
  overflow-y: auto;
  padding: 20px;
  background: #f9f9f9;
}

.message {
  margin-bottom: 20px;
  padding: 15px;
  border-radius: 8px;
}

.message.user {
  background: #007bff;
  color: white;
  margin-left: 20%;
}

.message.ai {
  background: white;
  border: 1px solid #ddd;
  margin-right: 20%;
}

.message.error {
  background: #ffebee;
  color: #c62828;
  border: 1px solid #ffcdd2;
}

.entities {
  margin-top: 15px;
  padding: 10px;
  background: #f5f5f5;
  border-radius: 4px;
}

.entity-card {
  background: white;
  padding: 10px;
  margin: 5px 0;
  border-radius: 4px;
  border-left: 4px solid #007bff;
}

.suggestions {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.suggestion-btn {
  padding: 8px 12px;
  background: #e3f2fd;
  border: 1px solid #2196f3;
  border-radius: 20px;
  cursor: pointer;
  font-size: 12px;
}

.suggestion-btn:hover {
  background: #2196f3;
  color: white;
}

.visualizations {
  margin-top: 10px;
  padding: 10px;
  background: #fff3e0;
  border-radius: 4px;
}

.viz-suggestion {
  padding: 5px 0;
  font-size: 14px;
}

.input-area {
  display: flex;
  padding: 20px;
  background: white;
  border-top: 1px solid #ddd;
}

.input-area input {
  flex: 1;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px 0 0 4px;
  font-size: 16px;
}

.input-area button {
  padding: 12px 24px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 0 4px 4px 0;
  cursor: pointer;
  font-size: 16px;
}

.input-area button:disabled {
  background: #ccc;
  cursor: not-allowed;
}
```

---

## 🔧 Advanced Features

### **1. Context-Aware Conversations**
The service automatically maintains context between queries:

```javascript
// First query
await chat.sendMessage('What are the top private equity firms?');
// Response includes: Blackstone, KKR, Apollo, etc.

// Follow-up query (automatically understands "it" refers to Blackstone)
await chat.sendMessage('Tell me more about it');
// Response: Information about Blackstone

// Another follow-up
await chat.sendMessage('Who are their competitors?');
// Response: Other PE firms excluding Blackstone
```

### **2. Custom User Preferences**
Configure how the AI responds:

```javascript
const preferences = {
  responseFormat: 'conversational', // 'conversational', 'structured', 'brief'
  includeCharts: true,              // Include visualization suggestions
  maxResults: 10,                   // Maximum entities per response
  industry: 'private_equity'        // Focus area (optional)
};
```

### **3. Rich Data Handling**
The service provides multiple data formats:

```javascript
const response = await chat.sendMessage('Show me Blackstone details');

console.log(response.message); // Natural language
// "Blackstone is one of the world's largest asset managers with $991.0B in AUM..."

console.log(response.entities[0]);
// {
//   name: "Blackstone",
//   aumFormatted: "$991.0B",
//   aum: 991000000000,
//   rank: 1,
//   highlight: "One of the world's largest asset managers"
// }
```

### **4. Error Handling**
Robust error handling with meaningful responses:

```javascript
try {
  const response = await chat.sendMessage('Invalid query...');
} catch (error) {
  if (error.response?.status === 400) {
    console.log('Invalid request format');
  } else if (error.response?.status === 404) {
    console.log('Session expired - create new session');
  } else {
    console.log('Service temporarily unavailable');
  }
}
```

---

## 📊 Data Types & Entities

The service provides information about various private markets entities:

### **Private Equity Firms**
- Name, AUM (formatted), Location
- Ranking, Highlights, Investment Focus
- Portfolio company count

### **Portfolio Companies**
- Company name, Sector, Industry
- Investor information, Investment details
- Financial metrics (when available)

### **Hedge Funds**
- Fund name, Strategy, AUM
- Performance metrics, Manager details

### **Real Estate Funds**
- Fund type, Geographic focus
- Property types, Investment size

---

## 🚀 Production Deployment

### **Environment Setup**
No environment variables required for basic usage. The service handles all configuration internally.

### **Rate Limits**
- 1000 requests per 15 minutes per IP
- Sessions automatically expire after 24 hours of inactivity
- Service auto-scales based on demand

### **Monitoring & Health Checks**
```javascript
// Check service health
const health = await fetch('https://merry-creativity-production.up.railway.app/health');
const status = await health.json();
console.log(status.status); // "healthy"

// Check wrapper stats
const stats = await fetch('https://merry-creativity-production.up.railway.app/api/wrapper/stats');
const metrics = await stats.json();
console.log(metrics.data.wrapper.uptime);
```

---

## 🐛 Troubleshooting

### **Common Issues**

1. **Session Not Found (404)**
   - Sessions expire after 24 hours
   - Create a new session or let the service auto-create one

2. **Invalid Message Format (400)**
   - Ensure `message` field is a non-empty string
   - Check Content-Type header is `application/json`

3. **Service Timeout**
   - Service might be scaling up (first request after idle)
   - Retry after 10-15 seconds

4. **Context Not Maintained**
   - Ensure you're using the same `sessionToken` for follow-up queries
   - Check that `userId` remains consistent

### **Debug Mode**
```javascript
// Enable verbose logging
const response = await fetch('https://merry-creativity-production.up.railway.app/api/wrapper/chat', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'X-Debug': 'true' // Add debug header
  },
  body: JSON.stringify(payload)
});
```

---

## 📞 Support & Contact

### **API Documentation**
- Live service: https://merry-creativity-production.up.railway.app
- Health check: https://merry-creativity-production.up.railway.app/health
- Service stats: https://merry-creativity-production.up.railway.app/api/wrapper/stats

### **GitHub Repository**
- Source code: https://github.com/vibecoder12/knowledge-store-deploy
- Issues & feature requests: Create GitHub issues

### **Service Status**
The service is deployed on Railway with automatic scaling and 99.9% uptime SLA.

---

## 📝 Changelog

### Version 1.0.0 (Current)
- ✅ Enhanced wrapper service with session management
- ✅ Conversational memory and context awareness
- ✅ Rich response formatting with suggestions
- ✅ Professional financial data formatting
- ✅ Multi-app integration support
- ✅ Visualization recommendations
- ✅ Production deployment on Railway

---

## 📄 License

This integration API is provided for integration purposes. Please contact for commercial licensing terms.

---

**Ready to integrate? Start with the Quick Start section above! 🚀**
