// Vercel Function: /api/image.js
// URL akses: /api/image?id=NOMOR   (contoh: /api/image?id=5)
//
// Tujuan: WhatsApp TIDAK BISA mengambil gambar langsung dari Google Drive / lh3.
// File ini bertugas sebagai "perantara": mengambil gambar dari Drive di belakang
// layar, lalu menyajikannya kembali dari domain situs kita sendiri (yang dipercaya
// WhatsApp). Gambar juga diperkecil ke JPG w800 supaya muat di batas preview WA.

// ═══════════════════════════════════════════════════════════════════════════
//  ISI SAMA dengan link CSV di index.html & share.js  →  tempel link CSV Sheets:
// ═══════════════════════════════════════════════════════════════════════════
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSZiJcrhwbweMcyjaIuRnrjV7aM-7Njwig6saIedosP77Qtp5Q7Wo-it-XuuKiUGV3NnAQkYMMO0UiM/pub?gid=632581624&single=true&output=csv";

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

// Mengambil ID file dari berbagai bentuk link Google Drive.
function getDriveFileId(url) {
  if (!url) return null;
  const m = url.match(/drive\.google\.com\/(?:file\/d\/([\w-]+)|(?:open|uc|thumbnail)\?(?:[^#]*&)?id=([\w-]+))/);
  if (m) return m[1] || m[2];
  if (/^[\w-]{20,}$/.test(url.trim())) return url.trim(); // ID murni
  return null;
}

export default async function handler(req, res) {
  const host  = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";
  const kopUrl = `${proto}://${host}/kop-surat.png`;
  const id = parseInt((req.query && req.query.id) || "0", 10);

  try {
    // 1) Ambil link gambar utama (kolom D / row[3]) dari baris ke-ID.
    const rows = parseCSV(await (await fetch(SHEET_CSV_URL)).text());
    rows.shift(); // buang baris judul kolom
    const row = rows[id - 1];
    const driveUrl = row ? (row[3] || "") : "";
    const fileId = getDriveFileId(driveUrl);

    // 2) Kalau tidak ada gambar, alihkan ke kop surat.
    if (!fileId) {
      res.setHeader("Location", kopUrl);
      return res.status(302).end();
    }

    // 3) Ambil versi JPG kecil (=w800-rj) supaya muat di batas WhatsApp.
    const imgRes = await fetch(`https://lh3.googleusercontent.com/d/${fileId}=w800-rj`);
    if (!imgRes.ok) {
      res.setHeader("Location", kopUrl);
      return res.status(302).end();
    }

    // 4) Sajikan dari domain sendiri.
    const contentType = imgRes.headers.get("content-type") || "image/jpeg";
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=120, s-maxage=120");
    return res.status(200).send(buffer);

  } catch (err) {
    res.setHeader("Location", kopUrl);
    return res.status(302).end();
  }
}
