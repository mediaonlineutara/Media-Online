// Vercel Function: /api/share.js
// URL akses: /api/share?id=NOMOR   (contoh: /api/share?id=5)
//
// Tugas file ini: membuat halaman dengan tag Open Graph (og) yang dibaca WhatsApp,
// supaya tiap artikel bisa di-share dengan preview (gambar + judul + keterangan).
// Setelah orang mengklik previewnya, ia diarahkan ke halaman utama dan artikel
// yang dimaksud langsung terbuka (lewat alamat /?a=NOMOR).

// ═══════════════════════════════════════════════════════════════════════════
//  ISI SAMA dengan link CSV di index.html  →  tempel link CSV Google Sheets:
// ═══════════════════════════════════════════════════════════════════════════
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSZiJcrhwbweMcyjaIuRnrjV7aM-7Njwig6saIedosP77Qtp5Q7Wo-it-XuuKiUGV3NnAQkYMMO0UiM/pub?gid=632581624&single=true&output=csv";

// Nama situs (muncul kecil di preview) — silakan ganti.
const NAMA_SITUS = "Media Online Utara";

// ── Parser CSV (sama dengan yang di index.html) ──
function parseCSV(text) {
  const rows = [];
  let i = 0;
  while (i < text.length) {
    const row = [];
    while (i < text.length) {
      let field = "";
      if (text[i] === '"') {
        i++;
        while (i < text.length) {
          if (text[i] === '"') {
            if (i+1 < text.length && text[i+1] === '"') { field += '"'; i += 2; }
            else { i++; break; }
          } else { field += text[i]; i++; }
        }
      } else {
        while (i < text.length && text[i] !== ',' && text[i] !== '\n' && text[i] !== '\r') {
          field += text[i]; i++;
        }
      }
      row.push(field.trim());
      if (i < text.length && text[i] === ',') { i++; }
      else { if (i < text.length && text[i] === '\r') i++; if (i < text.length && text[i] === '\n') i++; break; }
    }
    if (row.length > 1 && row.some(f => f !== "")) rows.push(row);
  }
  return rows;
}

// Amankan teks agar tidak merusak tag HTML (tanda kutip, < > &).
function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;").replace(/"/g, "&quot;")
    .replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function fetchCSV(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Gagal fetch CSV");
  return await res.text();
}

function generateHTML(title, description, imageUrl, shareUrl, redirectUrl) {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)} — ${esc(NAMA_SITUS)}</title>
  <meta property="og:title"        content="${esc(title)}" />
  <meta property="og:description"  content="${esc(description)}" />
  <meta property="og:image"        content="${imageUrl}" />
  <meta property="og:url"          content="${shareUrl}" />
  <meta property="og:type"         content="article" />
  <meta property="og:site_name"    content="${esc(NAMA_SITUS)}" />
  <meta name="twitter:card"        content="summary_large_image" />
  <meta name="twitter:title"       content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image"       content="${imageUrl}" />
  <style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#6b1f2a;color:#fff}p{text-align:center}a{color:#c9933a}</style>
</head>
<body>
  <p>Memuat...<br><a href="${redirectUrl}">Klik di sini jika tidak otomatis</a></p>
  <script>location.replace(${JSON.stringify(redirectUrl)});</script>
</body>
</html>`;
}

export default async function handler(req, res) {
  const host  = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";
  const BASE_URL = `${proto}://${host}`;

  const id     = parseInt((req.query && req.query.id) || "0", 10);
  const imgVer = Math.floor(Date.now() / 60000); // penyegar cache tiap menit

  const shareUrl    = `${BASE_URL}/api/share?id=${id}`;
  const redirectUrl = `${BASE_URL}/?a=${id}`;      // halaman utama, artikel auto-buka
  const KOP_URL     = `${BASE_URL}/kop-surat.png`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");

  try {
    const rows = parseCSV(await fetchCSV(SHEET_CSV_URL));
    rows.shift(); // buang baris judul kolom
    const row = rows[id - 1]; // ID = nomor baris data (mulai 1)

    if (!row) {
      return res.status(200).send(generateHTML(
        NAMA_SITUS, "Berita terkini Media Online Utara.", KOP_URL, shareUrl, redirectUrl
      ));
    }

    const judul      = row[0] || "Berita";
    const keterangan = row[1] || "";
    const isi        = row[2] || "";
    const gambar     = row[3] || "";

    // Keterangan preview: pakai kolom Keterangan; kalau kosong ambil awal Isi.
    let desc = (keterangan || isi).replace(/###|\*\*/g, "").replace(/\*/g, "").trim();
    if (desc.length > 160) desc = desc.substring(0, 157) + "...";

    // Gambar preview lewat perantara /api/image (domain sendiri) supaya WA bisa baca.
    // Kalau artikel ini tidak punya gambar, pakai kop surat.
    const imgUrl = gambar
      ? `${BASE_URL}/api/image?id=${id}&v=${imgVer}`
      : KOP_URL;

    return res.status(200).send(generateHTML(judul, desc, imgUrl, shareUrl, redirectUrl));

  } catch (err) {
    return res.status(200).send(generateHTML(
      NAMA_SITUS, "Berita terkini Media Online Utara.", KOP_URL, shareUrl, redirectUrl
    ));
  }
}
