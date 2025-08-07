/**
 * Private Markets Intelligence Agent - Simple Integration Example
 * 
 * Copy and paste this code to quickly integrate with your application.
 * Replace the placeholder values with your actual app/user IDs.
 */

// ===========================================
// BASIC INTEGRATION CLASS
// ===========================================

class PrivateMarketsChat {
  constructor(appId, userId) {
    this.baseUrl = 'https://merry-creativity-production.up.railway.app';
    this.appId = appId;
    this.userId = userId;
    this.sessionToken = null;
  }

  // Initialize a session (optional - will auto-create if not called)
  async initSession(userPreferences = {}) {
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
            maxResults: 5,
            ...userPreferences
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        this.sessionToken = data.sessionToken;
        console.log('✅ Session created:', data.sessionToken);
        return data;
      } else {
        throw new Error(data.error || 'Session creation failed');
      }
    } catch (error) {
      console.error('❌ Session creation failed:', error);
      throw error;
    }
  }

  // Send a chat message
  async sendMessage(message, options = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/api/wrapper/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          sessionToken: this.sessionToken,
          userId: this.userId,
          context: { 
            appId: this.appId,
            ...options.context 
          },
          metadata: options.metadata || {}
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        // Update session token (important for maintaining conversation)
        this.sessionToken = data.sessionToken;
        
        return {
          success: true,
          message: data.response.message,
          entities: data.response.data.entities,
          suggestions: data.response.suggestions,
          visualizations: data.response.visualizations,
          conversationContext: data.conversationContext,
          sessionToken: data.sessionToken
        };
      } else {
        throw new Error(data.error?.message || 'Chat request failed');
      }
    } catch (error) {
      console.error('❌ Chat message failed:', error);
      return {
        success: false,
        error: error.message,
        message: "I'm sorry, I encountered an error. Please try again."
      };
    }
  }

  // Get session information
  async getSessionInfo() {
    if (!this.sessionToken) {
      console.warn('⚠️ No active session token');
      return null;
    }
    
    try {
      const response = await fetch(`${this.baseUrl}/api/wrapper/session/${this.sessionToken}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          console.warn('⚠️ Session expired or not found');
          this.sessionToken = null;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('❌ Failed to get session info:', error);
      return null;
    }
  }

  // Delete current session
  async deleteSession() {
    if (!this.sessionToken) {
      console.warn('⚠️ No active session to delete');
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/wrapper/session/${this.sessionToken}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        console.log('✅ Session deleted successfully');
        this.sessionToken = null;
        return true;
      } else {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Failed to delete session:', error);
      return false;
    }
  }

  // Check service health
  async checkHealth() {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      const health = await response.json();
      return health.status === 'healthy';
    } catch (error) {
      console.error('❌ Health check failed:', error);
      return false;
    }
  }
}

// ===========================================
// USAGE EXAMPLES
// ===========================================

// Example 1: Basic Usage (Auto-Session)
async function basicExample() {
  console.log('\n🔍 Example 1: Basic Usage');
  
  const chat = new PrivateMarketsChat('my-web-app', 'user-123');
  
  // Send message without explicit session creation (auto-creates)
  const response = await chat.sendMessage('What are the top private equity firms?');
  
  console.log('AI Response:', response.message);
  console.log('Entities Found:', response.entities?.length || 0);
  console.log('Suggestions:', response.suggestions?.length || 0);
  
  // Follow-up message with context
  const followup = await chat.sendMessage('Tell me more about the first one');
  console.log('Follow-up Response:', followup.message);
}

// Example 2: Advanced Usage (With Session Management)
async function advancedExample() {
  console.log('\n🔍 Example 2: Advanced Usage with Session Management');
  
  const chat = new PrivateMarketsChat('my-advanced-app', 'user-456');
  
  // Check service health first
  const isHealthy = await chat.checkHealth();
  if (!isHealthy) {
    console.error('❌ Service is not healthy');
    return;
  }
  
  // Create session with custom preferences
  await chat.initSession({
    responseFormat: 'conversational',
    includeCharts: true,
    maxResults: 3
  });
  
  // Send multiple messages
  const queries = [
    'What are the largest private equity firms by AUM?',
    'How does Blackstone compare to its competitors?',
    'Show me some portfolio companies'
  ];
  
  for (const query of queries) {
    console.log(`\n👤 User: ${query}`);
    const response = await chat.sendMessage(query);
    console.log(`🤖 AI: ${response.message}`);
    
    if (response.suggestions?.length > 0) {
      console.log(`💡 Suggestions: ${response.suggestions.map(s => s.text).join(', ')}`);
    }
  }
  
  // Get session info
  const sessionInfo = await chat.getSessionInfo();
  if (sessionInfo) {
    console.log(`\n📊 Session Stats:`);
    console.log(`- Total Queries: ${sessionInfo.totalQueries}`);
    console.log(`- Entities Discussed: ${sessionInfo.entitiesDiscussed.join(', ')}`);
    console.log(`- Conversation Length: ${sessionInfo.conversationLength}`);
  }
  
  // Clean up
  await chat.deleteSession();
}

// Example 3: React Integration Pattern
function ReactExample() {
  console.log('\n🔍 Example 3: React Integration Pattern');
  
  // This would be used inside a React component
  const exampleReactCode = `
import React, { useState, useEffect } from 'react';

const ChatComponent = ({ userId, appId }) => {
  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Initialize chat
    const initChat = async () => {
      const chatInstance = new PrivateMarketsChat(appId, userId);
      await chatInstance.initSession();
      setChat(chatInstance);
    };
    initChat();
  }, [userId, appId]);

  const sendMessage = async () => {
    if (!input.trim() || !chat) return;
    
    setMessages(prev => [...prev, { type: 'user', content: input }]);
    setLoading(true);
    
    const response = await chat.sendMessage(input);
    
    setMessages(prev => [...prev, { 
      type: 'ai', 
      content: response.message,
      entities: response.entities,
      suggestions: response.suggestions
    }]);
    
    setInput('');
    setLoading(false);
  };

  return (
    <div className="chat-container">
      <div className="messages">
        {messages.map((msg, i) => (
          <div key={i} className={\`message \${msg.type}\`}>
            {msg.content}
            {msg.suggestions && (
              <div className="suggestions">
                {msg.suggestions.map((s, j) => (
                  <button key={j} onClick={() => setInput(s.text)}>
                    {s.text}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="input-area">
        <input 
          value={input} 
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about private markets..."
        />
        <button onClick={sendMessage} disabled={loading}>
          {loading ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
};
  `;
  
  console.log('React component code:');
  console.log(exampleReactCode);
}

// Example 4: Error Handling
async function errorHandlingExample() {
  console.log('\n🔍 Example 4: Error Handling');
  
  const chat = new PrivateMarketsChat('my-app', 'user-789');
  
  try {
    // This will work fine
    const response1 = await chat.sendMessage('What are private equity firms?');
    console.log('✅ Success:', response1.message);
    
    // Simulate error with invalid session
    chat.sessionToken = 'invalid-session-token';
    const response2 = await chat.sendMessage('Follow-up question');
    
    if (!response2.success) {
      console.log('⚠️ Handled error gracefully:', response2.error);
      
      // Reset and try again
      chat.sessionToken = null;
      const response3 = await chat.sendMessage('New conversation after error');
      console.log('✅ Recovered:', response3.message);
    }
    
  } catch (error) {
    console.error('❌ Unhandled error:', error);
  }
}

// ===========================================
// RUN EXAMPLES
// ===========================================

async function runAllExamples() {
  console.log('🚀 Private Markets Intelligence Agent - Integration Examples');
  console.log('=' .repeat(60));
  
  try {
    await basicExample();
    await advancedExample();
    ReactExample();
    await errorHandlingExample();
    
    console.log('\n✅ All examples completed successfully!');
    console.log('\n🎯 Next Steps:');
    console.log('1. Replace "my-web-app" and "user-123" with your actual values');
    console.log('2. Customize user preferences as needed');
    console.log('3. Integrate the chat class into your application');
    console.log('4. Style the UI components to match your design');
    
  } catch (error) {
    console.error('❌ Example execution failed:', error);
  }
}

// ===========================================
// QUICK TEST FUNCTION
// ===========================================

async function quickTest() {
  console.log('🧪 Quick Test - Private Markets Intelligence Agent');
  
  const chat = new PrivateMarketsChat('test-app', 'test-user');
  
  console.log('Testing basic functionality...');
  const response = await chat.sendMessage('What is Blackstone?');
  
  if (response.success) {
    console.log('✅ Integration test passed!');
    console.log('Response:', response.message);
  } else {
    console.log('❌ Integration test failed!');
    console.log('Error:', response.error);
  }
}

// ===========================================
// EXPORT FOR USE IN OTHER FILES
// ===========================================

// For Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PrivateMarketsChat,
    runAllExamples,
    quickTest
  };
}

// For browsers
if (typeof window !== 'undefined') {
  window.PrivateMarketsChat = PrivateMarketsChat;
  window.runExamples = runAllExamples;
  window.quickTest = quickTest;
}

// ===========================================
// AUTO-RUN IF CALLED DIRECTLY
// ===========================================

if (typeof require !== 'undefined' && require.main === module) {
  // Running directly in Node.js
  runAllExamples().then(() => {
    console.log('\n🎉 Integration examples completed!');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Failed to run examples:', error);
    process.exit(1);
  });
}
