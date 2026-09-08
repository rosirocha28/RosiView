/**
 * Script utilitário para publicação automática de Releases no GitHub
 * com upload de binários (.apk, .zip, .pdf).
 *
 * Utiliza as credenciais já salvas de forma segura no Windows Credential Manager.
 *
 * Uso:
 * node scripts/publish_github_release.js <tag> <title> <filePath> [assetName] [notes]
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

function getGitHubToken() {
  try {
    const input = 'protocol=https\nhost=github.com\n\n';
    const out = execSync('git credential fill', { input, encoding: 'utf8' });
    const match = out.match(/password=(.+)/);
    if (match && match[1]) {
      return match[1].trim();
    }
  } catch (e) {
    console.error('Falha ao recuperar token do Git Credential Manager:', e.message);
  }
  return null;
}

const args = process.argv.slice(2);
if (args.length < 3) {
  console.log('Uso: node scripts/publish_github_release.js <tag> <title> <filePath> [assetName] [notes]');
  process.exit(1);
}

const tag = args[0];
const title = args[1];
const filePath = path.resolve(args[2]);
const assetName = args[3] || path.basename(filePath);
const notes = args[4] || `Lançamento oficial da versão ${tag} do RosiView.`;

if (!fs.existsSync(filePath)) {
  console.error(`Erro: Arquivo '${filePath}' não encontrado.`);
  process.exit(1);
}

const token = getGitHubToken();
if (!token) {
  console.error('Erro: Não foi possível obter o token de acesso do GitHub via Git Credential Manager.');
  process.exit(1);
}

const REPO_OWNER = 'rosirocha28';
const REPO_NAME = 'RosiView';

function apiRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ statusCode: res.statusCode, data: parsed, headers: res.headers });
        } catch {
          resolve({ statusCode: res.statusCode, data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function run() {
  console.log(`\n🚀 Iniciando publicação da Release '${title}' (${tag})...`);

  // 1. Verifica se a release já existe
  const getRelOpt = {
    hostname: 'api.github.com',
    path: `/repos/${REPO_OWNER}/${REPO_NAME}/releases/tags/${encodeURIComponent(tag)}`,
    method: 'GET',
    headers: {
      'User-Agent': 'RosiView-Release-Publisher',
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  };

  let release = null;
  const existingRes = await apiRequest(getRelOpt);
  if (existingRes.statusCode === 200 && existingRes.data && existingRes.data.id) {
    console.log(`ℹ️ Release para a tag '${tag}' já existe (ID: ${existingRes.data.id}). Atualizando anexos...`);
    release = existingRes.data;
  } else {
    // 2. Cria a nova release
    console.log(`📦 Criando nova release no repositório ${REPO_OWNER}/${REPO_NAME}...`);
    const createPayload = JSON.stringify({
      tag_name: tag,
      name: title,
      body: notes,
      draft: false,
      prerelease: false
    });

    const createOpt = {
      hostname: 'api.github.com',
      path: `/repos/${REPO_OWNER}/${REPO_NAME}/releases`,
      method: 'POST',
      headers: {
        'User-Agent': 'RosiView-Release-Publisher',
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(createPayload)
      }
    };

    const createRes = await apiRequest(createOpt, createPayload);
    if (createRes.statusCode !== 201) {
      console.error('Erro ao criar release:', createRes.data);
      process.exit(1);
    }
    release = createRes.data;
    console.log(`✓ Release criada com sucesso! URL: ${release.html_url}`);
  }

  // 3. Se o asset já existir na release, remove para sobregravar
  if (release.assets && Array.isArray(release.assets)) {
    const existingAsset = release.assets.find(a => a.name === assetName);
    if (existingAsset) {
      console.log(`♻️ Removendo versão anterior de '${assetName}' (Asset ID: ${existingAsset.id})...`);
      const delOpt = {
        hostname: 'api.github.com',
        path: `/repos/${REPO_OWNER}/${REPO_NAME}/releases/assets/${existingAsset.id}`,
        method: 'DELETE',
        headers: {
          'User-Agent': 'RosiView-Release-Publisher',
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      };
      await apiRequest(delOpt);
    }
  }

  // 4. Upload do binário (APK ou ZIP)
  const fileBuffer = fs.readFileSync(filePath);
  const fileSize = fileBuffer.length;
  console.log(`📤 Enviando '${assetName}' (${(fileSize / (1024 * 1024)).toFixed(2)} MB)...`);

  const uploadUrlRaw = release.upload_url.split('{')[0];
  const uploadUrl = new URL(`${uploadUrlRaw}?name=${encodeURIComponent(assetName)}`);

  let mimeType = 'application/octet-stream';
  if (assetName.endsWith('.apk')) mimeType = 'application/vnd.android.package-archive';
  else if (assetName.endsWith('.zip')) mimeType = 'application/zip';
  else if (assetName.endsWith('.pdf')) mimeType = 'application/pdf';

  const uploadOptions = {
    hostname: uploadUrl.hostname,
    path: uploadUrl.pathname + uploadUrl.search,
    method: 'POST',
    headers: {
      'User-Agent': 'RosiView-Release-Publisher',
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': mimeType,
      'Content-Length': fileSize
    }
  };

  await new Promise((resolve, reject) => {
    const req = https.request(uploadOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 201) {
          console.log(`✅ Upload concluído com sucesso!`);
          try {
            const assetInfo = JSON.parse(data);
            console.log(`🔗 Link direto: ${assetInfo.browser_download_url}`);
          } catch {}
          resolve();
        } else {
          console.error(`Erro no upload (HTTP ${res.statusCode}):`, data);
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.write(fileBuffer);
    req.end();
  });

  console.log(`\n🎉 Release '${tag}' publicada e disponível publicamente!\n`);
}

run().catch(err => {
  console.error('Erro na execução do script:', err);
  process.exit(1);
});
