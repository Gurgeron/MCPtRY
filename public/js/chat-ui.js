document.addEventListener('DOMContentLoaded', () => {
  // DOM elements
  const messageInput = document.querySelector('.message-input input');
  const sendButton = document.querySelector('.send-button');
  const messageList = document.querySelector('.message-list');
  
  // Flow lines animation adjustment
  adjustFlowLines();
  window.addEventListener('resize', adjustFlowLines);
  
  // Handle message sending
  sendButton.addEventListener('click', sendMessage);
  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });
  
  // Adjust SVG flow lines based on current positions of icons and chat
  function adjustFlowLines() {
    const notionIcon = document.getElementById('notion-icon');
    const slackIcon = document.getElementById('slack-icon');
    const gdocsIcon = document.getElementById('google-docs-icon');
    const gmailIcon = document.getElementById('gmail-icon');
    const chatContainer = document.querySelector('.chat-container');
    
    const notionFlow = document.getElementById('notion-flow');
    const slackFlow = document.getElementById('slack-flow');
    const gdocsFlow = document.getElementById('gdocs-flow');
    const gmailFlow = document.getElementById('gmail-flow');
    
    if (notionIcon && notionFlow && chatContainer) {
      const notionRect = notionIcon.getBoundingClientRect();
      const chatRect = chatContainer.getBoundingClientRect();
      
      // Starting point is the bottom center of the icon
      const startX = notionRect.left + notionRect.width / 2;
      const startY = notionRect.bottom;
      
      // End point is the top of the chat container
      const endX = chatRect.left + chatRect.width * 0.2; // 20% from the left
      const endY = chatRect.top;
      
      // Curved path with control points
      notionFlow.setAttribute('d', `M${startX},${startY} C${startX},${startY + 50} ${endX - 50},${endY - 50} ${endX},${endY}`);
    }
    
    if (slackIcon && slackFlow && chatContainer) {
      const slackRect = slackIcon.getBoundingClientRect();
      const chatRect = chatContainer.getBoundingClientRect();
      
      const startX = slackRect.left + slackRect.width / 2;
      const startY = slackRect.bottom;
      
      const endX = chatRect.left + chatRect.width * 0.4; // 40% from the left
      const endY = chatRect.top;
      
      slackFlow.setAttribute('d', `M${startX},${startY} C${startX},${startY + 40} ${endX - 40},${endY - 40} ${endX},${endY}`);
    }
    
    if (gdocsIcon && gdocsFlow && chatContainer) {
      const gdocsRect = gdocsIcon.getBoundingClientRect();
      const chatRect = chatContainer.getBoundingClientRect();
      
      const startX = gdocsRect.left + gdocsRect.width / 2;
      const startY = gdocsRect.bottom;
      
      const endX = chatRect.left + chatRect.width * 0.6; // 60% from the left
      const endY = chatRect.top;
      
      gdocsFlow.setAttribute('d', `M${startX},${startY} C${startX},${startY + 30} ${endX - 30},${endY - 30} ${endX},${endY}`);
    }
    
    if (gmailIcon && gmailFlow && chatContainer) {
      const gmailRect = gmailIcon.getBoundingClientRect();
      const chatRect = chatContainer.getBoundingClientRect();
      
      const startX = gmailRect.left + gmailRect.width / 2;
      const startY = gmailRect.bottom;
      
      const endX = chatRect.left + chatRect.width * 0.8; // 80% from the left
      const endY = chatRect.top;
      
      gmailFlow.setAttribute('d', `M${startX},${startY} C${startX},${startY + 20} ${endX - 20},${endY - 20} ${endX},${endY}`);
    }
  }
  
  // Function to send a message
  function sendMessage() {
    const message = messageInput.value.trim();
    if (message === '') return;
    
    // Create a timestamp
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 || 12;
    const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
    const timeString = `${formattedHours}:${formattedMinutes} ${ampm}`;
    
    // Create the message HTML
    const messageHTML = `
      <div class="message user-message">
        <img src="images/user-avatar.svg" alt="You" class="message-avatar">
        <div class="message-content">
          <p>${message}</p>
          <div class="message-time">${timeString}</div>
        </div>
      </div>
    `;
    
    // Add the message to the list
    messageList.insertAdjacentHTML('beforeend', messageHTML);
    
    // Clear the input
    messageInput.value = '';
    
    // Scroll to the bottom
    messageList.scrollTop = messageList.scrollHeight;
    
    // Simulate a response after 1-2 seconds
    setTimeout(() => {
      // This would normally be where you'd call the backend API
      simulateResponse();
    }, 1000 + Math.random() * 1000);
  }
  
  // Simulate an assistant response
  function simulateResponse() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 || 12;
    const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
    const timeString = `${formattedHours}:${formattedMinutes} ${ampm}`;
    
    const responses = [
      "I'll help you with that right away.",
      "I've found some relevant information for you.",
      "Let me check your Google Docs for that information.",
      "I can assist you with that request."
    ];
    
    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
    
    const responseHTML = `
      <div class="message">
        <img src="images/user-avatar.svg" alt="Assistant" class="message-avatar">
        <div class="message-content">
          <div class="message-sender">Assistant</div>
          <p>${randomResponse}</p>
          <div class="message-time">${timeString}</div>
        </div>
      </div>
    `;
    
    // Add the response to the list
    messageList.insertAdjacentHTML('beforeend', responseHTML);
    
    // Scroll to the bottom
    messageList.scrollTop = messageList.scrollHeight;
  }
}); 