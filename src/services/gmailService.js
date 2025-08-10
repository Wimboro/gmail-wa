import { logger } from '../../utils/logger.js';

/**
 * Retrieve emails based on search query
 * @param {gmail_v1.Gmail} gmailService - Authenticated Gmail service
 * @param {string} searchQuery - Query to filter emails
 * @returns {Promise<Array>} - List of email messages
 */
export async function getEmails(gmailService, searchQuery) {
  try {
    logger.info(`Searching for emails with query: ${searchQuery}`);
    
    const response = await gmailService.users.messages.list({
      userId: 'me',
      q: searchQuery
    });
    
    const messages = response.data.messages || [];
    
    if (messages.length === 0) {
      logger.info('No messages found matching the criteria');
      return [];
    }
    
    logger.info(`Found ${messages.length} messages, retrieving details...`);
    
    // Get full message details
    const emails = [];
    for (const message of messages) {
      try {
        const fullMessage = await gmailService.users.messages.get({
          userId: 'me',
          id: message.id
        });
        
        emails.push(fullMessage.data);
        logger.debug(`Retrieved email with ID: ${message.id}`);
      } catch (error) {
        logger.warning(`Failed to retrieve email ${message.id}:`, error.message);
      }
    }
    
    logger.success(`Successfully retrieved ${emails.length} emails`);
    return emails;
    
  } catch (error) {
    logger.error('Error retrieving emails:', error.message);
    return [];
  }
}

/**
 * Extract the text content from an email message
 * @param {Object} messagePayload - The payload part of the email
 * @returns {string|null} - Extracted text content
 */
export function extractEmailBody(messagePayload) {
  try {
    // Handle multipart messages
    if (messagePayload.parts) {
      for (const part of messagePayload.parts) {
        // Look for plain text first
        if (part.mimeType === 'text/plain' && part.body?.data) {
          return Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
        
        // If no plain text, try HTML content
        if (part.mimeType === 'text/html' && part.body?.data) {
          const htmlContent = Buffer.from(part.body.data, 'base64').toString('utf-8');
          return extractTextFromHtml(htmlContent);
        }
        
        // Recursively check nested parts
        if (part.parts) {
          const nestedBody = extractEmailBody(part);
          if (nestedBody) return nestedBody;
        }
      }
    } else {
      // Handle single-part messages
      const data = messagePayload.body?.data;
      if (data) {
        const content = Buffer.from(data, 'base64').toString('utf-8');
        
        if (messagePayload.mimeType === 'text/html') {
          return extractTextFromHtml(content);
        } else {
          return content;
        }
      }
    }
    
    return null;
  } catch (error) {
    logger.error('Error extracting email body:', error.message);
    return null;
  }
}

/**
 * Simple HTML to text conversion
 * @param {string} html - HTML content
 * @returns {string} - Plain text content
 */
function extractTextFromHtml(html) {
  // Simple HTML tag removal - in production, consider using a proper HTML parser
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Mark an email as processed by adding a label and optionally marking it as read
 * @param {gmail_v1.Gmail} gmailService - Authenticated Gmail service
 * @param {string} messageId - ID of the email to mark
 * @param {string} labelName - Name of the label to apply
 * @param {boolean} markAsRead - Whether to mark the email as read
 */
export async function markEmailProcessed(gmailService, messageId, labelName = 'Processed-Financial', markAsRead = true) {
  try {
    // Check if label exists, create if not
    const labelsResponse = await gmailService.users.labels.list({ userId: 'me' });
    const labels = labelsResponse.data.labels || [];
    
    let labelId = labels.find(label => label.name === labelName)?.id;
    
    if (!labelId) {
      // Create new label
      const labelObject = {
        name: labelName,
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show'
      };
      
      const createdLabel = await gmailService.users.labels.create({
        userId: 'me',
        requestBody: labelObject
      });
      
      labelId = createdLabel.data.id;
      logger.info(`Created new label: ${labelName}`);
    }
    
    // Modify the message
    const modifyRequest = {
      addLabelIds: [labelId]
    };
    
    // If marking as read, remove the UNREAD label
    if (markAsRead) {
      modifyRequest.removeLabelIds = ['UNREAD'];
    }
    
    await gmailService.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: modifyRequest
    });
    
    const actionText = 'marked as processed' + (markAsRead ? ' and read' : '');
    logger.success(`Email ${messageId} ${actionText}`);
    
  } catch (error) {
    logger.error(`Error processing email ${messageId}:`, error.message);
  }
}

/**
 * Get email headers
 * @param {Object} message - Gmail message object
 * @returns {Object} - Object with common headers
 */
export function getEmailHeaders(message) {
  const headers = {};
  
  if (message.payload?.headers) {
    for (const header of message.payload.headers) {
      const name = header.name.toLowerCase();
      if (['from', 'to', 'subject', 'date'].includes(name)) {
        headers[name] = header.value;
      }
    }
  }
  
  return headers;
} 