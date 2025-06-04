import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import readline from 'readline';

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
const TOKEN_PATH = 'token.json';

async function authorize(): Promise<any> {
  const credentials = JSON.parse(fs.readFileSync('credentials.json', 'utf8'));
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  // Procura token previamente armazenado
  if (fs.existsSync(TOKEN_PATH)) {
    oAuth2Client.setCredentials(
      JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'))
    );
    return oAuth2Client;
  }

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const code = await new Promise<string>((resolve) =>
    rl.question('Enter the code from that page here: ', resolve)
  );
  rl.close();

  const token = (await oAuth2Client.getToken(code)).tokens;
  oAuth2Client.setCredentials(token);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
  console.log('Token stored to', TOKEN_PATH);
  return oAuth2Client;
}

async function listEmailsOnDate(auth: any, date: string) {
  const gmail = google.gmail({ version: 'v1', auth });
  // Formato do Gmail: YYYY/MM/DD
  const res = await gmail.users.messages.list({
    userId: 'me',
    q: `after:${date} before:${date}`,
    maxResults: 10, // definir conforme necessário
  });
  const messages = res.data.messages || [];
  if (messages.length === 0) {
    console.log('Nenhum e-mail encontrado nesta data.');
    return;
  }

  for (const msg of messages) {
    const msgDetail = await gmail.users.messages.get({
      userId: 'me',
      id: msg.id!,
      format: 'metadata',
      metadataHeaders: ['Subject', 'From', 'Date'],
    });
    console.log(msgDetail.data.payload?.headers);
  }
}

// Chame assim:
authorize().then((auth) => {
  // Exemplo: pegar emails de 4 de junho de 2024
  listEmailsOnDate(auth, '2024/06/04');
});
