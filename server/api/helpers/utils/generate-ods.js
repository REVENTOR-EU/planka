const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default ContentType="application/xml" Extension="xml"/>
  <Default ContentType="application/zip" Extension="ods"/>
  <Override ContentType="text/xml" PartName="/content.xml"/>
  <Override ContentType="text/xml" PartName="/styles.xml"/>
  <Override ContentType="text/xml" PartName="/meta.xml"/>
</Types>`;

const MANIFEST_XML = `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">
  <manifest:file-entry manifest:media-type="application/vnd.oasis.opendocument.spreadsheet" manifest:full-path="/"/>
  <manifest:file-entry manifest:media-type="text/xml" manifest:full-path="content.xml"/>
  <manifest:file-entry manifest:media-type="text/xml" manifest:full-path="styles.xml"/>
  <manifest:file-entry manifest:media-type="text/xml" manifest:full-path="meta.xml"/>
</manifest:manifest>`;

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
  xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"
  office:version="1.2">
</office:document-styles>`;

const META_XML = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0"
  office:version="1.2">
  <office:meta>
    <meta:generator>Planka Time Report</meta:generator>
  </office:meta>
</office:document-meta>`;

function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildContentXml(rows) {
  let cellsXml = '';

  rows.forEach((row) => {
    cellsXml += '      <table:table-row>\n';
    row.forEach((cell) => {
      if (cell === null || cell === undefined) {
        cellsXml += '        <table:table-cell />\n';
      } else {
        cellsXml += `        <table:table-cell office:value-type="string">
          <text:p>${escapeXml(cell)}</text:p>
        </table:table-cell>\n`;
      }
    });
    cellsXml += '      </table:table-row>\n';
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"
  xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
  office:version="1.2">
  <office:body>
    <office:spreadsheet>
      <table:table table:name="Time Report">
        <table:table-columns>
          <table:table-column table:number-columns-repeated="6" />
        </table:table-columns>
${cellsXml}      </table:table>
    </office:spreadsheet>
  </office:body>
</office:document-content>`;
}

function crc32(buf) {
  let crc = 0xffffffff;
  const table = [];

  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let j = 0; j < 8; j += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }

  for (let i = 0; i < buf.length; i += 1) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function createZipFile(files) {
  const localHeaders = [];
  const centralHeaders = [];
  let offset = 0;

  files.forEach(({ name, content }) => {
    const nameBuf = Buffer.from(name, 'utf8');
    const contentBuf = Buffer.from(content, 'utf8');
    const crc = crc32(contentBuf);

    const localHeader = Buffer.alloc(30 + nameBuf.length);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(contentBuf.length, 18);
    localHeader.writeUInt32LE(contentBuf.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    nameBuf.copy(localHeader, 30);

    localHeaders.push(localHeader);
    localHeaders.push(contentBuf);

    const centralHeader = Buffer.alloc(46 + nameBuf.length);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(contentBuf.length, 20);
    centralHeader.writeUInt32LE(contentBuf.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt32LE(offset, 42);
    nameBuf.copy(centralHeader, 46);

    centralHeaders.push(centralHeader);
    offset += localHeader.length + contentBuf.length;
  });

  const centralSize = centralHeaders.reduce((sum, h) => sum + h.length, 0);
  const centralOffset = offset;

  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(files.length, 8);
  endRecord.writeUInt16LE(files.length, 10);
  endRecord.writeUInt32LE(centralSize, 12);
  endRecord.writeUInt32LE(centralOffset, 16);

  return Buffer.concat([...localHeaders, ...centralHeaders, endRecord]);
}

const formatDuration = (seconds) => {
  if (!seconds) return '0h 00m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m < 10 ? '0' : ''}${m}m`;
};

const formatDate = (dateStr) => {
  const d = new Date(dateStr);
  return d.toISOString().split('T')[0];
};

const formatTime = (dateStr) => {
  const d = new Date(dateStr);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

module.exports = {
  inputs: {
    listName: {
      type: 'string',
      required: true,
    },
    cards: {
      type: 'ref',
      required: true,
    },
    timeEntries: {
      type: 'ref',
      required: true,
    },
    users: {
      type: 'ref',
      required: true,
    },
  },

  async fn(inputs) {
    const { listName, cards, timeEntries, users } = inputs;

    const userById = _.keyBy(users, 'id');
    const entriesByCardId = _.groupBy(timeEntries, 'cardId');

    const rows = [];

    rows.push(['Card Name', 'Person', 'Date', 'Start Time', 'End Time', 'Duration']);

    const userTotals = {};
    let grandTotal = 0;

    cards.forEach((card) => {
      const cardEntries = entriesByCardId[card.id] || [];
      let cardTotal = 0;

      cardEntries.forEach((entry) => {
        const userName = userById[entry.userId]
          ? userById[entry.userId].name
          : 'Unknown';
        const duration = entry.duration || 0;
        cardTotal += duration;

        if (!userTotals[userName]) {
          userTotals[userName] = 0;
        }
        userTotals[userName] += duration;

        rows.push([
          card.name,
          userName,
          entry.startedAt ? formatDate(entry.startedAt) : '',
          entry.startedAt ? formatTime(entry.startedAt) : '',
          entry.stoppedAt ? formatTime(entry.stoppedAt) : '',
          formatDuration(duration),
        ]);
      });

      if (cardEntries.length > 0) {
        rows.push([`TOTAL: ${card.name}`, '', '', '', '', formatDuration(cardTotal)]);
        rows.push([]);
        grandTotal += cardTotal;
      }
    });

    rows.push([]);
    rows.push(['Summary by Person']);
    rows.push(['Person', 'Total Time']);

    Object.entries(userTotals).forEach(([userName, total]) => {
      rows.push([userName, formatDuration(total)]);
    });

    rows.push([]);
    rows.push(['Grand Total', formatDuration(grandTotal)]);

    const contentXml = buildContentXml(rows);

    const zipBuffer = createZipFile([
      { name: '[Content_Types].xml', content: CONTENT_TYPES_XML },
      { name: 'META-INF/manifest.xml', content: MANIFEST_XML },
      { name: 'content.xml', content: contentXml },
      { name: 'styles.xml', content: STYLES_XML },
      { name: 'meta.xml', content: META_XML },
    ]);

    return zipBuffer;
  },
};
