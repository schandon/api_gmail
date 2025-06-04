import { google } from 'googleapis';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { format } from 'date-fns';
import dotenv from 'dotenv';
import readline from 'readline';

dotenv.config();

interface Email {
  id: string;
  date: string;
  subject: string;
  from: string;
  snippet: string;
}

class GmailService {
  private oauth2Client;
  private TOKEN_PATH = 'token.json';

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'http://localhost'
    );
  }

  private async getNewToken(): Promise<void> {
    const url = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/gmail.readonly'],
      prompt: 'consent'
    });

    console.log('Authorize this app by visiting this URL:', url);
    console.log('\nAfter authorization, Google will redirect you to localhost.');
    console.log('Since localhost is not running a server, you\'ll see an error page.');
    console.log('Copy the "code" parameter from the URL and paste it here.\n');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const code = await new Promise<string>((resolve) => {
      rl.question('Enter the code from the URL here: ', (code) => {
        rl.close();
        resolve(code);
      });
    });

    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);
      writeFileSync(this.TOKEN_PATH, JSON.stringify(tokens));
      console.log('Token stored successfully to', this.TOKEN_PATH);
    } catch (error) {
      console.error('Error getting tokens:', error);
      throw error;
    }
  }

  async authorize() {
    try {
      if (existsSync(this.TOKEN_PATH)) {
        const token = JSON.parse(readFileSync(this.TOKEN_PATH, 'utf-8'));
        this.oauth2Client.setCredentials(token);
      } else {
        await this.getNewToken();
      }
    } catch (error) {
      console.error('Error during authorization:', error);
      await this.getNewToken();
    }
  }

  async getEmails(date: Date): Promise<Email[]> {
    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
    const formattedDate = format(date, 'yyyy/MM/dd');
    const query = `after:${formattedDate} before:${formattedDate}`;

    try {
      const response = await gmail.users.messages.list({
        userId: 'me',
        q: query
      });

      const emails: Email[] = [];
      
      if (response.data.messages) {
        for (const message of response.data.messages) {
          const email = await gmail.users.messages.get({
            userId: 'me',
            id: message.id!
          });

          const headers = email.data.payload?.headers;
          const subject = headers?.find(h => h.name === 'Subject')?.value || '';
          const from = headers?.find(h => h.name === 'From')?.value || '';
          const date = headers?.find(h => h.name === 'Date')?.value || '';

          emails.push({
            id: message.id!,
            date,
            subject,
            from,
            snippet: email.data.snippet || ''
          });
        }
      }

      return emails;
    } catch (error) {
      console.error('Error fetching emails:', error);
      throw error;
    }
  }

  async saveEmailsForDate(date: Date) {
    try {
      const emails = await this.getEmails(date);
      const fileName = `emails_${format(date, 'yyyy-MM-dd')}.json`;
      
      writeFileSync(fileName, JSON.stringify(emails, null, 2));
      console.log(`Emails saved to ${fileName}`);
    } catch (error) {
      console.error('Error saving emails:', error);
      throw error;
    }
  }
}

// Usage example
const gmailService = new GmailService();
const targetDate = new Date(2025, 5, 4); // Note: month is 0-based, so 5 represents June

// First, authorize the application
gmailService.authorize().then(() => {
  // After authorization, fetch and save emails from June 4th, 2025
  gmailService.saveEmailsForDate(targetDate);
});