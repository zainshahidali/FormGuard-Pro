async function testInspectApi() {
  console.log('Sending request to http://localhost:3001/api/sites/inspect-url for https://skincreationsg.com/ ...');
  try {
    const res = await fetch('http://localhost:3001/api/sites/inspect-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://skincreationsg.com/', deepScan: true })
    });
    const data = await res.json();
    console.log('Status:', res.status);
    console.log('Response success:', data.success);
    console.log('Discovered forms count:', data.count || data.forms?.length);
    console.log('Forms summary:', data.forms?.map(f => ({
      title: f.title,
      plugin: f.detectedPlugin,
      pageUrl: f.pageUrl,
      fieldsCount: f.fields?.length,
      fieldLabels: f.fields?.map(fl => fl.label)
    })));
  } catch (e) {
    console.error('Fetch error:', e.message);
  }
}

testInspectApi();
