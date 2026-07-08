const fs = require('fs');
const token = 'bab70b42d0ec4ab98b8fa3f979c9530e';
const headers = { 'Authorization': 'Token ' + token };
let url = 'https://api.sketchfab.com/v3/collections/574c456663334fe89c78503a975dc946/models?count=24';

async function run() {
  let allModels = [];
  try {
    while (url) {
      console.log('Fetching', url);
      const res = await fetch(url, { headers });
      const data = await res.json();
      allModels.push(...data.results);
      url = data.next;
    }
    console.log(`Found ${allModels.length} models.`);
    allModels.forEach(m => {
      console.log(`- ${m.name} (${m.uid}) [Downloadable: ${m.isDownloadable}]`);
    });
  } catch (err) {
    console.error(err);
  }
}

run();
