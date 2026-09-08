const SHEET_HEADERS = [
  'NO',
  'TGL MASUK',
  'NO.REG',
  'PENGADU',
  'URAIAN ADUAN',
  'KLASIFIKASI ADUAN',
  'KODE',
  'MEDIA',
  'TGL & JAM MULAI TL',
  'TGL & JAM SELESAI TL',
  'RESPONSE TIME',
  'HANDLING TIME',
  'HASIL KLARIFIKASI',
  'KEPUASAN PENGADU',
  'STATUS',
  'KETEPATAN WAKTU',
  'NO. TELEPON'
];

const CODE_LIMITS = {
  P1: 2,
  P2: 5,
  P3: 14
};


/* =========================================================
   LOGIN
========================================================= */

function checkLogin(username, password) {

  const USERNAME = 'admin';
  const PASSWORD = 'admin111';

  username = String(username || '').trim();
  password = String(password || '');

  if (
    username === USERNAME &&
    password === PASSWORD
  ) {

    PropertiesService
      .getUserProperties()
      .setProperty(
        'IS_LOGGED_IN',
        'true'
      );

    return {
      success: true,
      name: 'Admin',
      role: 'Administrator'
    };

  }

  return {
    success: false,
    message: 'Username atau password salah.'
  };

}


/* =========================================================
   LOGIN USER
   Dipanggil oleh Index.html
========================================================= */

function loginUser(username, password) {

  return checkLogin(
    username,
    password
  );

}


/* =========================================================
   CEK SESSION
========================================================= */

function checkSession() {

  const loggedIn =
    PropertiesService
      .getUserProperties()
      .getProperty(
        'IS_LOGGED_IN'
      );

  return {
    loggedIn:
      loggedIn === 'true',

    name:
      'Admin',

    role:
      'Administrator'
  };

}


/* =========================================================
   LOGOUT
========================================================= */

function logout() {

  PropertiesService
    .getUserProperties()
    .deleteProperty(
      'IS_LOGGED_IN'
    );

  return {
    success: true
  };

}


/* =========================================================
   HALAMAN WEB APP
   SEKARANG HANYA INDEX.HTML
========================================================= */

function doGet(e) {

  return HtmlService
    .createHtmlOutputFromFile('Index')
    .setTitle(
      'Rekap Pengaduan Rumah Sakit'
    )
    .setXFrameOptionsMode(
      HtmlService.XFrameOptionsMode.ALLOWALL
    );

}


/* =========================================================
   DATA AWAL FORM
========================================================= */

function getFormInit(year) {

  const y = String(
    year ||
    new Date().getFullYear()
  );

  return {

    year: y,

    register:
      getNextRegister_(y),

    now:
      Utilities.formatDate(
        new Date(),
        Session.getScriptTimeZone(),
        "yyyy-MM-dd'T'HH:mm"
      )

  };

}


/* =========================================================
   SIMPAN PENGADUAN
========================================================= */

function saveComplaint(data) {

  /* -------------------------------------------------------
     VALIDASI DATA DASAR
  ------------------------------------------------------- */

  validateData_(data);


  /* -------------------------------------------------------
     BUAT TANGGAL MASUK
  ------------------------------------------------------- */

  const tglMasuk =
    makeDate_(
      data.tglMasuk,
      data.jamMasuk
    );


  const year =
    String(
      tglMasuk.getFullYear()
    );


  /* -------------------------------------------------------
     AMBIL SPREADSHEET
  ------------------------------------------------------- */

  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();


  const sh =
    ss.getSheetByName(
      year
    );


  if (!sh) {

    throw new Error(
      'Sheet tahun ' +
      year +
      ' belum tersedia.'
    );

  }


  /* -------------------------------------------------------
     CEK HEADER
  ------------------------------------------------------- */

  ensureHeaders_(sh);


  /* -------------------------------------------------------
     LOCK
  ------------------------------------------------------- */

  const lock =
    LockService
      .getDocumentLock();


  lock.waitLock(30000);


  try {

    /* =====================================================
       NOMOR OTOMATIS
    ===================================================== */

    const no =
      getNextNo_(sh);


    const reg =
      getNextRegister_(year);


    /* =====================================================
       WAKTU TINDAK LANJUT
    ===================================================== */

    const mulai =
      data.tglMulai
        ? makeDate_(
            data.tglMulai,
            data.jamMulai
          )
        : null;


    const selesai =
      data.tglSelesai
        ? makeDate_(
            data.tglSelesai,
            data.jamSelesai
          )
        : null;


    /* =====================================================
       VALIDASI URUTAN WAKTU
    ===================================================== */

    if (
      mulai &&
      mulai < tglMasuk
    ) {

      throw new Error(
        'Tanggal/Jam Mulai Tindak Lanjut tidak boleh lebih awal dari TGL. MASUK.'
      );

    }


    if (
      selesai &&
      !mulai
    ) {

      throw new Error(
        'Isi TGL. & JAM MULAI TINDAK LANJUT terlebih dahulu.'
      );

    }


    if (
      selesai &&
      mulai &&
      selesai < mulai
    ) {

      throw new Error(
        'Tanggal/Jam Selesai Tindak Lanjut tidak boleh lebih awal dari waktu mulai.'
      );

    }


    /* =====================================================
       RESPONSE TIME
       TGL MASUK -> MULAI TL
    ===================================================== */

    const responseMinutes =
      mulai
        ? diffMinutes_(
            tglMasuk,
            mulai
          )
        : null;


    /* =====================================================
       HANDLING TIME
       MULAI TL -> SELESAI
    ===================================================== */

    const handlingMinutes =
      mulai && selesai
        ? diffMinutes_(
            mulai,
            selesai
          )
        : null;


    /* =====================================================
       STATUS OTOMATIS
    ===================================================== */

    let status;


    if (selesai) {

      status =
        'SELESAI';

    }

    else if (mulai) {

      status =
        'DALAM PROSES';

    }

    else {

      status =
        'DITERIMA';

    }


    /* =====================================================
       KETEPATAN WAKTU
    ===================================================== */

    let ketepatan =
      '-';


    if (
      selesai &&
      mulai &&
      handlingMinutes !== null
    ) {

      const batasHari =
        CODE_LIMITS[data.kode];


      const batasMenit =
        batasHari *
        24 *
        60;


      ketepatan =
        handlingMinutes <= batasMenit
          ? 'TEPAT WAKTU'
          : 'TERLAMBAT';

    }


    /* =====================================================
       DATA YANG DISIMPAN
    ===================================================== */

    const row = [

  no,

  tglMasuk,

  reg,

  data.pengadu,

  data.uraian,

  data.klasifikasi,

  data.kode,

  data.media,

  mulai || '',

  selesai || '',

  formatDuration_(
    responseMinutes
  ),

  formatDuration_(
    handlingMinutes
  ),

  data.hasilKlarifikasi || '',

  '',

  status,

  ketepatan,

  data.telepon || ''

];


    /* =====================================================
       SIMPAN
    ===================================================== */

    sh.appendRow(
      row
    );

    
    /* =====================================================
       NOMOR BARIS
    ===================================================== */

    const r =
      sh.getLastRow();


    /* =====================================================
       HASIL
    ===================================================== */

    return {

      success: true,

      year: year,

      no: no,

      register: reg,

      responseTime:
        formatDuration_(
          responseMinutes
        ),

      handlingTime:
        formatDuration_(
          handlingMinutes
        ),

      status:
        status,

      ketepatan:
        ketepatan,

      row:
        r

    };


  }

  finally {

    lock.releaseLock();

  }

}


/* =========================================================
   SIMPAN PENGADUAN DARI HALAMAN PUBLIK
========================================================= */
function savePublicComplaint(data) {
  data=data||{};
  const pengadu=String(data.pengadu||'').trim();
  const telepon=String(data.telepon||'').trim();
  const uraian=String(data.uraian||'').trim();

  if(!pengadu)throw new Error('Nama Pengadu wajib diisi.');
  if(!uraian)throw new Error('Uraian Aduan wajib diisi.');
  if(uraian.length>1000)throw new Error('Uraian Aduan maksimal 1000 karakter.');

  const now=new Date();
  const year=String(now.getFullYear());
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const sh=ss.getSheetByName(year);

  if(!sh)throw new Error('Sheet tahun '+year+' belum tersedia.');

  ensureHeaders_(sh);

  const lock=LockService.getDocumentLock();
  lock.waitLock(30000);

  try{
    const no=getNextNo_(sh);
    const reg=getNextRegister_(year);
    const row=[
      no,now,reg,pengadu,uraian,'','','','','','-','-','','','DITERIMA','-',telepon
    ];
    sh.appendRow(row);
    return {success:true,year:year,no:no,register:reg};
  }
  finally{
    lock.releaseLock();
  }
}

/* =========================================================
   NOMOR REGISTER
========================================================= */

function getNextRegister_(year) {

  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();


  const sh =
    ss.getSheetByName(
      String(year)
    );


  if (
    !sh ||
    sh.getLastRow() < 2
  ) {

    return (
      'REG-0001/' +
      year
    );

  }


  const values =
    sh.getRange(
      2,
      3,
      sh.getLastRow() - 1,
      1
    )
    .getDisplayValues()
    .flat();


  let max = 0;


  const re =
    /^REG-(\d+)\/(\d{4})$/i;


  values.forEach(
    function(v) {

      const m =
        String(v)
          .trim()
          .match(re);


      if (
        m &&
        m[2] === String(year)
      ) {

        max =
          Math.max(
            max,
            Number(m[1])
          );

      }

    }
  );


  return (
    'REG-' +
    String(max + 1)
      .padStart(4, '0') +
    '/' +
    year
  );

}


/* =========================================================
   NOMOR URUT
========================================================= */

function getNextNo_(sh) {

  if (
    sh.getLastRow() < 2
  ) {

    return 1;

  }


  const values =
    sh.getRange(
      2,
      1,
      sh.getLastRow() - 1,
      1
    )
    .getValues()
    .flat();


  let max = 0;


  values.forEach(
    function(v) {

      if (
        typeof v === 'number'
      ) {

        max =
          Math.max(
            max,
            v
          );

      }

      else if (
        /^\d+$/.test(
          String(v)
        )
      ) {

        max =
          Math.max(
            max,
            Number(v)
          );

      }

    }
  );


  return max + 1;

}


/* =========================================================
   HEADER
========================================================= */

function ensureHeaders_(sh) {

  const current =
    sh.getRange(
      1,
      1,
      1,
      SHEET_HEADERS.length
    )
    .getDisplayValues()[0];


  const mismatch =
    SHEET_HEADERS.some(
      function(h, i) {

        return current[i] !== h;

      }
    );


  if (mismatch) {

    sh.getRange(
      1,
      1,
      1,
      SHEET_HEADERS.length
    )
    .setValues([
      SHEET_HEADERS
    ]);

  }

}


/* =========================================================
   VALIDASI DATA
========================================================= */

function validateData_(d) {

  if (!d) {

    throw new Error(
      'Data pengaduan tidak ditemukan.'
    );

  }


  const required = [

    [
      'TGL. MASUK',
      d.tglMasuk
    ],

    [
      'Jam Masuk',
      d.jamMasuk
    ],

    [
      'Pengadu',
      d.pengadu
    ],

    [
      'Uraian Aduan',
      d.uraian
    ],

    [
      'Klasifikasi Aduan',
      d.klasifikasi
    ],

    [
      'Kode',
      d.kode
    ],

    [
      'Media',
      d.media
    ]

  ];


  const missing =
    required
      .filter(
        function(x) {

          return !String(
            x[1] || ''
          ).trim();

        }
      )
      .map(
        function(x) {

          return x[0];

        }
      );


  if (
    missing.length
  ) {

    throw new Error(
      'Lengkapi: ' +
      missing.join(', ')
    );

  }


  if (
    !CODE_LIMITS[d.kode]
  ) {

    throw new Error(
      'Kode tidak valid.'
    );

  }

}


/* =========================================================
   KONVERSI TANGGAL
========================================================= */

function makeDate_(
  dateStr,
  timeStr
) {

  const parts =
    String(dateStr)
      .split('-')
      .map(Number);


  const y =
    parts[0];

  const m =
    parts[1];

  const d =
    parts[2];


  const timeParts =
    String(
      timeStr || '00:00'
    )
    .split(':')
    .map(Number);


  const hh =
    Number(
      timeParts[0] || 0
    );


  const mm =
    Number(
      timeParts[1] || 0
    );


  return new Date(
    y,
    m - 1,
    d,
    hh,
    mm,
    0,
    0
  );

}


/* =========================================================
   SELISIH MENIT
========================================================= */

function diffMinutes_(
  a,
  b
) {

  return Math.max(
    0,
    Math.round(
      (b - a) /
      60000
    )
  );

}


/* =========================================================
   FORMAT DURASI
========================================================= */

function formatDuration_(
  minutes
) {

  if (
    minutes === null ||
    minutes === undefined ||
    minutes === ''
  ) {

    return '-';

  }


  const total =
    Math.max(
      0,
      Number(minutes)
    );


  const days =
    Math.floor(
      total / 1440
    );


  const hours =
    Math.floor(
      (total % 1440) / 60
    );


  const mins =
    total % 60;


  return (
    days +
    ' Hari ' +
    hours +
    ' Jam ' +
    mins +
    ' Menit'
  );

}

/* =========================================================
   DAFTAR ADUAN
   Membaca sheet 2023 - 2026

   Tambahan:
   - tahun     : nama sheet sumber data
   - rowNumber : nomor baris asli di spreadsheet

   Digunakan agar UPDATE TINDAK LANJUT
   langsung menuju baris aduan yang dipilih.
========================================================= */

function getDaftarAduan() {

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();


  const years = [
    '2023',
    '2024',
    '2025',
    '2026'
  ];


  const result = [];


  years.forEach(function(year) {

    const sh =
      ss.getSheetByName(year);


    if (!sh) {
      return;
    }


    const lastRow =
      sh.getLastRow();


    if (lastRow < 2) {
      return;
    }


    /*
 * Baca kolom A:S
 * 19 kolom
 */

const values =
  sh.getRange(
    2,
    1,
    lastRow - 1,
    19
  ).getValues();


    /*
     * rowIndex dimulai dari 0
     *
     * Karena values dimulai dari baris 2,
     * maka nomor baris asli spreadsheet:
     *
     * rowIndex + 2
     */

    values.forEach(function(row, rowIndex) {


      /* =================================================
         LEWATI BARIS KOSONG
      ================================================= */

      if (
        row.every(function(cell) {

          return (
            cell === '' ||
            cell === null
          );

        })
      ) {

        return;

      }


      /* =================================================
         NOMOR BARIS ASLI DI SHEET
      ================================================= */

      const sheetRowNumber =
        rowIndex + 2;


      /* =================================================
         TANGGAL / JAM TINDAK LANJUT
      ================================================= */

      let tglMulai = '';
      let jamMulai = '';

      let tglSelesai = '';
      let jamSelesai = '';


      /*
       * Kolom I = Tanggal & Jam Mulai
       */

      if (
        row[8] !== '' &&
        row[8] !== null
      ) {

        tglMulai =
          formatComplaintDateOnly_(
            row[8]
          );

        jamMulai =
          formatComplaintTimeOnly_(
            row[8]
          );

      }


      /*
       * Kolom J = Tanggal & Jam Selesai
       */

      if (
        row[9] !== '' &&
        row[9] !== null
      ) {

        tglSelesai =
          formatComplaintDateOnly_(
            row[9]
          );

        jamSelesai =
          formatComplaintTimeOnly_(
            row[9]
          );

      }


      /* =================================================
         DATA ADUAN
      ================================================= */

      result.push({

        /* =========================
           DATA DASAR
        ========================= */

        no:
          row[0],

        tglMasuk:
          formatComplaintDate_(
            row[1]
          ),

        /*
         * Jam masuk diperlukan
         * untuk menghitung Response Time
         */

        jamMasuk:
          formatComplaintTimeOnly_(
            row[1]
          ),

        register:
          row[2],

        pengadu:
          row[3],

        uraian:
          row[4],

        klasifikasi:
          row[5],

        kode:
          row[6],

        media:
          row[7],


        /* =========================
           TINDAK LANJUT
        ========================= */

        tglMulai:
          tglMulai,

        jamMulai:
          jamMulai,

        tglSelesai:
          tglSelesai,

        jamSelesai:
          jamSelesai,


        /*
         * Field lama tetap dipertahankan
         * agar kompatibel dengan tampilan lama.
         */

        mulai:
          formatComplaintDateTime_(
            row[8]
          ),

        selesai:
          formatComplaintDateTime_(
            row[9]
          ),


        /* =========================
           WAKTU
        ========================= */

        response:
          row[10],

        handling:
          row[11],


        /* =========================
           HASIL PENANGANAN
           KOLOM M = HASIL KLARIFIKASI
        ========================= */

        hasil:
          row[12] !== null &&
          row[12] !== undefined
            ? String(row[12]).trim()
            : '',

        hasilKlarifikasi:
          row[12] !== null &&
          row[12] !== undefined
            ? String(row[12]).trim()
            : '',

        hasilPenanganan:
          row[12] !== null &&
          row[12] !== undefined
            ? String(row[12]).trim()
            : '',


        /* =========================
           KEPUASAN
        ========================= */

        kepuasan:
          row[13] !== null &&
          row[13] !== undefined
            ? String(row[13]).trim()
            : '',

        kepuasanPengadu:
          row[13] !== null &&
          row[13] !== undefined
            ? String(row[13]).trim()
            : '',


        /* =========================
           STATUS
        ========================= */

        status:
          row[14],

        ketepatan:
          row[15],

        telepon:
          row[16] !== null &&
          row[16] !== undefined
            ? String(row[16]).trim()
            : '',

        buktiDukung:
          row[17] !== null &&
          row[17] !== undefined
            ? String(row[17]).trim()
            : '',

        buktiTindakLanjut:
          row[18] !== null &&
          row[18] !== undefined
            ? String(row[18]).trim()
            : '',


        /* =================================================
           REFERENSI DATA ASLI
           
           PENTING:
           Data ini digunakan oleh Update Tindak Lanjut
           agar langsung mengarah ke baris yang dipilih.
        ================================================= */

        tahun:
          year,

        rowNumber:
          sheetRowNumber

      });

    });

  });


    /* =====================================================
     URUTKAN DATA TERBARU DI ATAS
     -----------------------------------------------------
     Tahun terbaru → paling atas
     Dalam tahun yang sama:
     baris spreadsheet terbaru → paling atas
  ===================================================== */

  result.sort(function(a, b) {

    const tahunA =
      Number(a.tahun || 0);

    const tahunB =
      Number(b.tahun || 0);


    /* Tahun terbaru lebih dahulu */
    if (tahunA !== tahunB) {

      return tahunB - tahunA;

    }


    /* Data yang berada di baris
       paling bawah = data terbaru */
    return (
      Number(b.rowNumber || 0) -
      Number(a.rowNumber || 0)
    );

  });


  return result;

}


/* =========================================================
   FORMAT TANGGAL
========================================================= */

function formatComplaintDate_(value) {

  if (!value) {
    return '';
  }

  if (
    Object.prototype.toString.call(value)
    === '[object Date]'
  ) {

    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone(),
      'dd/MM/yyyy'
    );

  }

  return String(value);

}


/* =========================================================
   FORMAT TANGGAL + JAM
========================================================= */

function formatComplaintDateTime_(value) {

  if (!value) {
    return '';
  }

  if (
    Object.prototype.toString.call(value)
    === '[object Date]'
  ) {

    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone(),
      'dd/MM/yyyy HH:mm'
    );

  }

  return String(value);

}


/* =========================================================
   FORMAT TANGGAL SAJA
========================================================= */

function formatComplaintDateOnly_(value) {

  if (!value) {
    return '';
  }


  if (
    Object.prototype.toString.call(value)
    === '[object Date]'
  ) {

    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone(),
      'yyyy-MM-dd'
    );

  }


  const text =
    String(value).trim();


  /*
   * Jika sudah format yyyy-MM-dd
   */

  if (
    /^\d{4}-\d{2}-\d{2}$/.test(text)
  ) {

    return text;

  }


  /*
   * Jika format dd/MM/yyyy
   */

  const parts =
    text.split('/');


  if(parts.length === 3){

    return (
      parts[2] +
      '-' +
      String(parts[1]).padStart(2,'0') +
      '-' +
      String(parts[0]).padStart(2,'0')
    );

  }


  return '';

}


/* =========================================================
   FORMAT JAM SAJA
========================================================= */

function formatComplaintTimeOnly_(value) {

  if (!value) {
    return '';
  }


  if (
    Object.prototype.toString.call(value)
    === '[object Date]'
  ) {

    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone(),
      'HH:mm'
    );

  }


  const text =
    String(value).trim();


  /*
   * Ambil jam dari teks
   * contoh:
   * 24/08/2026 13:45
   */

  const match =
    text.match(
      /(\d{1,2}):(\d{2})/
    );


  if(match){

    return (
      String(match[1]).padStart(2,'0') +
      ':' +
      match[2]
    );

  }


  return '';

}


/* =========================================================
   PARSE TANGGAL UNTUK SORTING
========================================================= */

function parseComplaintDate_(value) {

  if (!value) {
    return new Date(0);
  }

  const parts =
    String(value).split('/');

  if (parts.length === 3) {

    return new Date(
      Number(parts[2]),
      Number(parts[1]) - 1,
      Number(parts[0])
    );

  }

  const d =
    new Date(value);

  return isNaN(d.getTime())
    ? new Date(0)
    : d;

}

/* =========================================================
   UPDATE TINDAK LANJUT
   ---------------------------------------------------------
   - Mencari register langsung pada KOLOM C
   - Berlaku untuk data baru maupun data lama
   - Data tindak lanjut lama boleh kosong
   - Data lama tetap dipertahankan jika input baru kosong
   - Struktur sheet A:P
========================================================= */

function updateTindakLanjut(
  register,
  tglMulai,
  jamMulai,
  tglSelesai,
  jamSelesai,
  hasil,
  kepuasan,
  buktiTindakLanjut
){

  try {

    const ss =
      SpreadsheetApp.getActiveSpreadsheet();

    const years = [
      '2023',
      '2024',
      '2025',
      '2026'
    ];

    const targetRegister =
      String(register || '').trim();
    
    /* =====================================================
   FOLDER BUKTI TINDAK LANJUT
===================================================== */

const BUKTI_TINDAK_LANJUT_FOLDER_ID =
  '1efAR76MHcT2Ad-Kkj9k5h1oCJEdqGMO5';


    /* =====================================================
       VALIDASI REGISTER
    ===================================================== */

    if (!targetRegister) {

      throw new Error(
        'No. Register Aduan tidak boleh kosong.'
      );

    }


    let sheet = null;
    let rowNumber = 0;


    /* =====================================================
       CARI REGISTER
       -----------------------------------------------------
       STRUKTUR:
       A = No.
       B = Tgl Masuk
       C = No. Register
       D = Pengadu
       E = Uraian
       F = Klasifikasi
       G = Kode
       H = Media
       I = Mulai
       J = Selesai
       K = Response Time
       L = Handling Time
       M = Hasil Klarifikasi
       N = Kepuasan Pengadu
       O = Status
       P = Ketepatan Waktu
    ===================================================== */

    for (
      let i = 0;
      i < years.length;
      i++
    ) {

      const sh =
        ss.getSheetByName(
          years[i]
        );


      if (!sh) {
        continue;
      }


      const lastRow =
        sh.getLastRow();


      if (lastRow < 2) {
        continue;
      }


      /*
       * Baca hanya kolom C
       * karena No. Register memang berada
       * di kolom C.
       */

      const registerValues =
        sh.getRange(
          2,
          3,
          lastRow - 1,
          1
        ).getDisplayValues();


      for (
        let r = 0;
        r < registerValues.length;
        r++
      ) {

        const sheetRegister =
          String(
            registerValues[r][0] || ''
          ).trim();


        if (
          sheetRegister ===
          targetRegister
        ) {

          sheet =
            sh;

          rowNumber =
            r + 2;

          break;

        }

      }


      if (sheet) {
        break;
      }

    }


    /* =====================================================
       REGISTER TIDAK DITEMUKAN
    ===================================================== */

    if (!sheet || !rowNumber) {

      throw new Error(
        'Data Pengaduan dengan No. Register ' +
        targetRegister +
        ' tidak ditemukan pada sheet 2023-2026.'
      );

    }


    /* =====================================================
       AMBIL DATA LAMA
    ===================================================== */

    const oldRow =
      sheet
        .getRange(
          rowNumber,
          1,
          1,
          19
        )
        .getValues()[0];


    /* =====================================================
       DATA LAMA
    ===================================================== */

    const oldMulai =
      oldRow[8];

    const oldSelesai =
      oldRow[9];

    const oldHasil =
      oldRow[12];

    const oldKepuasan =
      oldRow[13];


    /* =====================================================
       TANGGAL / JAM MULAI
       -----------------------------------------------------
       Jika input baru ada → gunakan input baru.
       Jika kosong → pertahankan data lama.
    ===================================================== */

    let finalTglMulai =
      String(tglMulai || '').trim();

    let finalJamMulai =
      String(jamMulai || '').trim();


    if (
      !finalTglMulai &&
      oldMulai
    ) {

      finalTglMulai =
        formatComplaintDateOnly_(
          oldMulai
        );

    }


    if (
      !finalJamMulai &&
      oldMulai
    ) {

      finalJamMulai =
        formatComplaintTimeOnly_(
          oldMulai
        );

    }


    /* =====================================================
       TANGGAL / JAM SELESAI
    ===================================================== */

    let finalTglSelesai =
      String(tglSelesai || '').trim();

    let finalJamSelesai =
      String(jamSelesai || '').trim();


    if (
      !finalTglSelesai &&
      oldSelesai
    ) {

      finalTglSelesai =
        formatComplaintDateOnly_(
          oldSelesai
        );

    }


    if (
      !finalJamSelesai &&
      oldSelesai
    ) {

      finalJamSelesai =
        formatComplaintTimeOnly_(
          oldSelesai
        );

    }


    /* =====================================================
       HASIL KLARIFIKASI
       -----------------------------------------------------
       Jika modal mengirim nilai → gunakan nilai tersebut.
       Jika kosong → pertahankan nilai lama.
    ===================================================== */

    let finalHasil =
      String(hasil || '').trim();


    if (!finalHasil) {

      finalHasil =
        String(
          oldHasil || ''
        ).trim();

    }


    /* =====================================================
       KEPUASAN PENGADU
    ===================================================== */

    let finalKepuasan =
      String(kepuasan || '').trim();


    if (!finalKepuasan) {

      finalKepuasan =
        String(
          oldKepuasan || ''
        ).trim();

    }


    /* =====================================================
   UPLOAD BUKTI TINDAK LANJUT
   -----------------------------------------------------
   Folder Drive:
   1efAR76MHcT2Ad-Kkj9k5h1oCJEdqGMO5

   Spreadsheet:
   Kolom S = 19
===================================================== */

let buktiTindakLanjutUrl = '';


if(
  buktiTindakLanjut &&
  buktiTindakLanjut.base64 &&
  buktiTindakLanjut.name
){

  const folderTindakLanjut =
    DriveApp.getFolderById(
      BUKTI_TINDAK_LANJUT_FOLDER_ID
    );


  const bytesTindakLanjut =
    Utilities.base64Decode(
      buktiTindakLanjut.base64
    );


  const blobTindakLanjut =
    Utilities.newBlob(
      bytesTindakLanjut,
      buktiTindakLanjut.mimeType ||
      MimeType.PLAIN_TEXT,
      buktiTindakLanjut.name
    );


  const uploadedFileTindakLanjut =
    folderTindakLanjut.createFile(
      blobTindakLanjut
    );


  buktiTindakLanjutUrl =
    uploadedFileTindakLanjut.getUrl();


  /* SIMPAN LINK KE KOLOM S */

  sheet
    .getRange(
      rowNumber,
      19
    )
    .setValue(
      buktiTindakLanjutUrl
    );

}


    /* =====================================================
       SIMPAN TANGGAL/JAM MULAI
       KOLOM I
    ===================================================== */

    const nilaiMulai =
      combineDateTime(
        finalTglMulai,
        finalJamMulai
      );


    sheet
      .getRange(
        rowNumber,
        9
      )
      .setValue(
        nilaiMulai || ''
      );


    /* =====================================================
       SIMPAN TANGGAL/JAM SELESAI
       KOLOM J
    ===================================================== */

    const nilaiSelesai =
      combineDateTime(
        finalTglSelesai,
        finalJamSelesai
      );


    sheet
      .getRange(
        rowNumber,
        10
      )
      .setValue(
        nilaiSelesai || ''
      );


    /* =====================================================
       HASIL KLARIFIKASI
       KOLOM M
    ===================================================== */

    sheet
      .getRange(
        rowNumber,
        13
      )
      .setValue(
        finalHasil
      );


    /* =====================================================
       KEPUASAN PENGADU
       KOLOM N
    ===================================================== */

    sheet
      .getRange(
        rowNumber,
        14
      )
      .setValue(
        finalKepuasan
      );


    /* =====================================================
       RESPONSE TIME
       KOLOM K
    ===================================================== */

    const waktuMasuk =
      oldRow[1];


    const responseMinutes =
      calculateMinutes(
        waktuMasuk,
        '',
        finalTglMulai,
        finalJamMulai
      );


    sheet
      .getRange(
        rowNumber,
        11
      )
      .setValue(

        responseMinutes !== null
          ? formatDurationServer(
              responseMinutes
            )
          : ''

      );


    /* =====================================================
       HANDLING TIME
       KOLOM L
    ===================================================== */

    const handlingMinutes =
      calculateDuration(
        finalTglMulai,
        finalJamMulai,
        finalTglSelesai,
        finalJamSelesai
      );


    sheet
      .getRange(
        rowNumber,
        12
      )
      .setValue(

        handlingMinutes !== null
          ? formatDurationServer(
              handlingMinutes
            )
          : ''

      );


    /* =====================================================
       STATUS
       KOLOM O
    ===================================================== */

    let status =
      'DITERIMA';


    if (finalTglSelesai) {

      status =
        'SELESAI';

    }

    else if (finalTglMulai) {

      status =
        'DALAM PROSES';

    }


    sheet
      .getRange(
        rowNumber,
        15
      )
      .setValue(
        status
      );


  /* =====================================================
   KETEPATAN WAKTU
   KOLOM P
   -----------------------------------------------------
   Hanya ada 2 kondisi:
   - TEPAT WAKTU
   - TERLAMBAT

   Jika belum selesai:
   - kosong (-)
===================================================== */

let ketepatan = '-';


/*
 * Ketepatan waktu baru dihitung
 * jika tindak lanjut SUDAH SELESAI.
 */
if (
  finalTglSelesai &&
  finalJamSelesai
) {

  /*
   * Ambil kode prioritas
   * dari kolom G
   */
  const kodeRaw =
  String(
    oldRow[6] || ''
  )
  .trim()
  .toUpperCase();


const kodeMatch =
  kodeRaw.match(
    /^P[123]/
  );


const kode =
  kodeMatch
    ? kodeMatch[0]
    : kodeRaw;


  /*
   * Batas waktu penyelesaian
   * dalam satuan HARI
   */
  const limits = {

    P1: 2,
    P2: 5,
    P3: 14

  };


  /*
   * Pastikan kode memiliki
   * batas waktu yang valid.
   */
  if (
    kode &&
    Object.prototype.hasOwnProperty.call(
      limits,
      kode
    )
  ) {

    const handling =
      calculateDuration(
        finalTglMulai,
        finalJamMulai,
        finalTglSelesai,
        finalJamSelesai
      );


    /*
     * Jika durasi valid,
     * tentukan tepat waktu / terlambat.
     */
    if (handling !== null) {

      ketepatan =
        handling <=
        limits[kode] * 1440

          ? 'TEPAT WAKTU'

          : 'TERLAMBAT';

    }

  }

}


/*
 * Simpan ke kolom P
 */
sheet
  .getRange(
    rowNumber,
    16
  )
  .setValue(
    ketepatan
  );


    /* =====================================================
       FORMAT KOLOM TANGGAL
       -----------------------------------------------------
       Pastikan kolom I dan J tetap sebagai tanggal + jam.
    ===================================================== */

    if (nilaiMulai) {

      sheet
        .getRange(
          rowNumber,
          9
        )
        .setNumberFormat(
          'dd/MM/yyyy HH:mm'
        );

    }


    if (nilaiSelesai) {

      sheet
        .getRange(
          rowNumber,
          10
        )
        .setNumberFormat(
          'dd/MM/yyyy HH:mm'
        );

    }


    SpreadsheetApp.flush();


    /* =====================================================
       HASIL
    ===================================================== */

    return {

  success: true,

  message:
    buktiTindakLanjutUrl
      ? 'Update tindak lanjut dan Bukti Tindak Lanjut berhasil disimpan.'
      : 'Update tindak lanjut berhasil disimpan.',

  register:
    targetRegister,

  status:
    status,

  ketepatan:
    ketepatan,

  buktiTindakLanjut:
    buktiTindakLanjutUrl

};


  }

  catch (error) {

    console.error(
      'updateTindakLanjut:',
      error
    );


    return {

      success: false,

      message:
        error.message ||
        'Gagal menyimpan update tindak lanjut.'

    };

  }

}


/* =========================================================
   HAPUS PENGADUAN
   ---------------------------------------------------------
   Mencari No. Register pada kolom C di sheet tahun
   kemudian menghapus baris yang sesuai.
========================================================= */

function deleteComplaint(register){

  const targetRegister =
    String(register || '')
      .trim();


  if(!targetRegister){

    throw new Error(
      'No. Register Aduan tidak boleh kosong.'
    );

  }


  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();


  const years = [
    '2023',
    '2024',
    '2025',
    '2026'
  ];


  const lock =
    LockService
      .getDocumentLock();


  lock.waitLock(30000);


  try{

    let targetSheet =
      null;

    let targetRow =
      0;


    /* ===================================================
       CARI REGISTER DI KOLOM C
    =================================================== */

    for(
      let i = 0;
      i < years.length;
      i++
    ){

      const sh =
        ss.getSheetByName(
          years[i]
        );


      if(!sh){
        continue;
      }


      const lastRow =
        sh.getLastRow();


      if(lastRow < 2){
        continue;
      }


      const values =
        sh.getRange(
          2,
          3,
          lastRow - 1,
          1
        )
        .getDisplayValues();


      for(
        let r = 0;
        r < values.length;
        r++
      ){

        const sheetRegister =
          String(
            values[r][0] || ''
          )
          .trim();


        if(
          sheetRegister ===
          targetRegister
        ){

          targetSheet =
            sh;

          targetRow =
            r + 2;

          break;

        }

      }


      if(targetSheet){
        break;
      }

    }


    /* ===================================================
       REGISTER TIDAK DITEMUKAN
    =================================================== */

    if(
      !targetSheet ||
      !targetRow
    ){

      throw new Error(
        'Data Pengaduan dengan No. Register ' +
        targetRegister +
        ' tidak ditemukan.'
      );

    }


    /* ===================================================
       HAPUS BARIS
    =================================================== */

    targetSheet.deleteRow(
      targetRow
    );


    SpreadsheetApp.flush();


    /* ===================================================
       HASIL
    =================================================== */

    return {

      success: true,

      register:
        targetRegister,

      message:
        'Aduan ' +
        targetRegister +
        ' berhasil dihapus.'

    };

  }

  finally{

    lock.releaseLock();

  }

}


/* =========================================================
   UPDATE DATA PENGADUAN
   ---------------------------------------------------------
   Memperbarui:
   - Pengadu
   - Klasifikasi Aduan
   - Media
   - Uraian Aduan
   - Kode / Grade

   No. Register tidak diubah.
   Tanggal, waktu, tindak lanjut, dan indikator
   tetap dipertahankan.
========================================================= */

function updateDataAduan(
  register,
  pengadu,
  klasifikasi,
  media,
  uraian,
  kode,
  buktiDukung
){

  const targetRegister =
    String(register || '')
      .trim();


  const finalPengadu =
    String(pengadu || '')
      .trim();


  const finalKlasifikasi =
    String(klasifikasi || '')
      .trim();


  const finalMedia =
    String(media || '')
      .trim();


  const finalUraian =
    String(uraian || '')
      .trim();


  const finalKode =
    String(kode || '')
      .trim()
      .toUpperCase();

  
  /* =======================================================
   FOLDER BUKTI DUKUNG
======================================================= */

const BUKTI_DUKUNG_FOLDER_ID =
  '1PRHVCZjry4oj5oo4wlJNagnonRoVKcRw';


  /* =======================================================
     VALIDASI DASAR
  ======================================================= */

  if(!targetRegister){

    throw new Error(
      'No. Register Aduan tidak ditemukan.'
    );

  }


  if(!finalPengadu){

    throw new Error(
      'Nama Pengadu wajib diisi.'
    );

  }


  if(!finalKlasifikasi){

    throw new Error(
      'Klasifikasi Aduan wajib dipilih.'
    );

  }


  if(!finalMedia){

    throw new Error(
      'Media Pengaduan wajib dipilih.'
    );

  }


  if(!finalUraian){

    throw new Error(
      'Uraian Aduan wajib diisi.'
    );

  }


  if(finalUraian.length > 1000){

    throw new Error(
      'Uraian Aduan maksimal 1000 karakter.'
    );

  }


  if(!CODE_LIMITS[finalKode]){

    throw new Error(
      'Kode / Grade tidak valid.'
    );

  }


  /* =======================================================
     SPREADSHEET
  ======================================================= */

  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();


  const years = [
    '2023',
    '2024',
    '2025',
    '2026'
  ];


  const lock =
    LockService
      .getDocumentLock();


  lock.waitLock(30000);


  try{

    let targetSheet =
      null;

    let targetRow =
      0;


    /* =====================================================
       CARI NO. REGISTER PADA KOLOM C
    ===================================================== */

    for(
      let i = 0;
      i < years.length;
      i++
    ){

      const sh =
        ss.getSheetByName(
          years[i]
        );


      if(!sh){
        continue;
      }


      const lastRow =
        sh.getLastRow();


      if(lastRow < 2){
        continue;
      }


      const registerValues =
        sh.getRange(
          2,
          3,
          lastRow - 1,
          1
        )
        .getDisplayValues();


      for(
        let r = 0;
        r < registerValues.length;
        r++
      ){

        const sheetRegister =
          String(
            registerValues[r][0] || ''
          )
          .trim();


        if(
          sheetRegister ===
          targetRegister
        ){

          targetSheet =
            sh;

          targetRow =
            r + 2;

          break;

        }

      }


      if(targetSheet){
        break;
      }

    }


    /* =====================================================
       DATA TIDAK DITEMUKAN
    ===================================================== */

    if(
      !targetSheet ||
      !targetRow
    ){

      throw new Error(
        'Data Pengaduan dengan No. Register ' +
        targetRegister +
        ' tidak ditemukan.'
      );

    }


    /* =====================================================
   UPLOAD BUKTI DUKUNG
===================================================== */

let buktiDukungUrl = '';

if(
  buktiDukung &&
  buktiDukung.base64 &&
  buktiDukung.name
){

  const folder =
    DriveApp.getFolderById(
      BUKTI_DUKUNG_FOLDER_ID
    );


  const bytes =
    Utilities.base64Decode(
      buktiDukung.base64
    );


  const blob =
    Utilities.newBlob(
      bytes,
      buktiDukung.mimeType ||
      MimeType.PLAIN_TEXT,
      buktiDukung.name
    );


  const uploadedFile =
    folder.createFile(
      blob
    );


  buktiDukungUrl =
    uploadedFile.getUrl();


  /* SIMPAN LINK KE KOLOM R */

  targetSheet
    .getRange(
      targetRow,
      18
    )
    .setValue(
      buktiDukungUrl
    );

}


    /* =====================================================
       UPDATE KOLOM
       -----------------------------------------------------
       A = NO
       B = TGL MASUK
       C = NO.REG
       D = PENGADU
       E = URAIAN ADUAN
       F = KLASIFIKASI ADUAN
       G = KODE
       H = MEDIA

       Kolom lain TIDAK disentuh.
    ===================================================== */

    targetSheet
      .getRange(
        targetRow,
        4
      )
      .setValue(
        finalPengadu
      );


    targetSheet
      .getRange(
        targetRow,
        5
      )
      .setValue(
        finalUraian
      );


    targetSheet
      .getRange(
        targetRow,
        6
      )
      .setValue(
        finalKlasifikasi
      );


    targetSheet
      .getRange(
        targetRow,
        7
      )
      .setValue(
        finalKode
      );


    targetSheet
      .getRange(
        targetRow,
        8
      )
      .setValue(
        finalMedia
      );


    /* =======================================================
   BUKTI DUKUNG
   R = 18
======================================================= */

if(buktiDukungUrl){

  targetSheet
    .getRange(
      targetRow,
      18
    )
    .setValue(
      buktiDukungUrl
    );

}


    SpreadsheetApp.flush();


    /* =====================================================
       HASIL
    ===================================================== */

    return {

  success: true,

  register:
    targetRegister,

  buktiDukung:
    buktiDukungUrl,

  message:
    buktiDukungUrl
      ? 'Data pengaduan dan Bukti Dukung berhasil diperbarui.'
      : 'Data pengaduan berhasil diperbarui.'

};

  }

  finally{

    lock.releaseLock();

  }

}


/* =========================================================
   HELPER CARI KOLOM
========================================================= */

function findColumn(
  col,
  names
){

  for(
    let i = 0;
    i < names.length;
    i++
  ){

    const key =
      String(names[i])
        .trim()
        .toLowerCase();


    if(
      Object.prototype
        .hasOwnProperty
        .call(col,key)
    ){

      return col[key];

    }

  }


  return null;

}


/* =========================================================
   SET NILAI JIKA KOLOM ADA
========================================================= */

function setIfColumn(
  sheet,
  row,
  col,
  names,
  value
){

  const column =
    findColumn(
      col,
      names
    );


  if(column){

    sheet
      .getRange(
        row,
        column
      )
      .setValue(value);

  }

}


/* =========================================================
   GABUNG TANGGAL + JAM
========================================================= */

function combineDateTime(
  dateValue,
  timeValue
){

  if(!dateValue){

    return '';

  }


  if(!timeValue){

    return dateValue;

  }


  return (
    dateValue +
    ' ' +
    timeValue
  );

}


/* =========================================================
   HITUNG DURASI
========================================================= */

function calculateDuration(
  tglMulai,
  jamMulai,
  tglSelesai,
  jamSelesai
){

  if(
    !tglMulai ||
    !jamMulai ||
    !tglSelesai ||
    !jamSelesai
  ){

    return null;

  }


  const mulai =
    new Date(
      tglMulai +
      'T' +
      jamMulai
    );


  const selesai =
    new Date(
      tglSelesai +
      'T' +
      jamSelesai
    );


  const diff =
    Math.round(
      (selesai - mulai) /
      60000
    );


  return Math.max(
    0,
    diff
  );

}


/* =========================================================
   HITUNG RESPONSE TIME
========================================================= */

function calculateMinutes(
  oldDate,
  oldTime,
  newDate,
  newTime
){

  if(
    !oldDate ||
    !newDate ||
    !newTime
  ){

    return null;

  }


  let masuk;


  if(
    oldDate instanceof Date
  ){

    masuk =
      new Date(oldDate);

    if(oldTime){

      const parts =
        String(oldTime)
          .split(':');

      masuk.setHours(
        Number(parts[0]) || 0,
        Number(parts[1]) || 0,
        0,
        0
      );

    }

  }

  else{

    masuk =
      new Date(
        String(oldDate) +
        'T' +
        String(oldTime || '00:00')
      );

  }


  const mulai =
    new Date(
      newDate +
      'T' +
      newTime
    );


  if(
    isNaN(masuk.getTime()) ||
    isNaN(mulai.getTime())
  ){

    return null;

  }


  return Math.max(
    0,
    Math.round(
      (mulai - masuk) /
      60000
    )
  );

}


/* =========================================================
   FORMAT DURASI SERVER
========================================================= */

function formatDurationServer(
  totalMinutes
){

  totalMinutes =
    Math.max(
      0,
      Number(totalMinutes) || 0
    );


  const days =
    Math.floor(
      totalMinutes / 1440
    );


  const hours =
    Math.floor(
      (totalMinutes % 1440) / 60
    );


  const minutes =
    totalMinutes % 60;


  if(days > 0){

    return (
      days +
      ' Hari ' +
      hours +
      ' Jam ' +
      minutes +
      ' Menit'
    );

  }


  if(hours > 0){

    return (
      hours +
      ' Jam ' +
      minutes +
      ' Menit'
    );

  }


  return (
    minutes +
    ' Menit'
  );

}


/* =========================================================
   AMBIL NILAI CELL
========================================================= */

function findCellValue(
  data,
  rowNumber,
  registerCol,
  col,
  names
){

  const column =
    findColumn(
      col,
      names
    );


  if(!column){

    return '';

  }


  return data[
    rowNumber - 1
  ][
    column - 1
  ];

}

/* =========================================================
   DAFTAR ADUAN PUBLIK
   ---------------------------------------------------------
   Hanya menampilkan data tahun yang diminta.
   Tidak menyediakan fungsi edit / hapus / update.
========================================================= */

function getPublicComplaintList(
  tahun
){

  const year =
    String(
      tahun || new Date().getFullYear()
    )
    .trim();


  if(!/^\d{4}$/.test(year)){

    throw new Error(
      'Tahun tidak valid.'
    );

  }


  const ss =
    SpreadsheetApp
      .getActiveSpreadsheet();


  const sh =
    ss.getSheetByName(
      year
    );


  if(!sh){

    return [];

  }


  const lastRow =
    sh.getLastRow();


  if(lastRow < 2){

    return [];

  }


  /*
   * Mengambil seluruh data yang ada.
   */

  const values =
    sh.getRange(
      2,
      1,
      lastRow - 1,
      17
    )
    .getDisplayValues();


  const data = [];


  values.forEach(
    function(row){

      const register =
        String(
          row[2] || ''
        )
        .trim();


      if(!register){

        return;

      }


      const pengadu =
        String(
          row[3] || ''
        )
        .trim();


      const uraian =
        String(
          row[4] || ''
        )
        .trim();


      const tglMasuk =
        String(
          row[1] || ''
        )
        .trim();


      const status =
        String(
          row[14] || ''
        )
        .trim();


      data.push({

        register:
          register,

        tglMasuk:
          tglMasuk,

        pengaduMasked:
          maskPublicName(
            pengadu
          ),

        uraian:
          uraian,

        status:
          status

      });

    }
  );


  /*
   * Terbaru → terlama.
   */

  data.sort(
    function(a,b){

      return (
        publicDateValue(
          b.tglMasuk
        ) -
        publicDateValue(
          a.tglMasuk
        )
      );

    }
  );


  return data;

}


/* =========================================================
   MASKING NAMA PENGADU
========================================================= */

function maskPublicName(
  name
){

  const text =
    String(
      name || ''
    )
    .trim();


  if(!text){

    return '-';

  }


  return text
    .split(/\s+/)
    .map(
      function(word){

        if(
          word.length <= 1
        ){

          return '*';

        }


        return (
          word.charAt(0) +
          '*'.repeat(
            Math.max(
              1,
              word.length - 1
            )
          )
        );

      }
    )
    .join(' ');

}


/* =========================================================
   NILAI SORT TANGGAL PUBLIK
========================================================= */

function publicDateValue(
  value
){

  const text =
    String(
      value || ''
    )
    .trim();


  const parts =
    text.split('/');


  if(
    parts.length !== 3
  ){

    return 0;

  }


  const day =
    Number(parts[0]);

  const month =
    Number(parts[1]);

  const year =
    Number(parts[2]);


  return new Date(
    year,
    month - 1,
    day
  ).getTime();

}
