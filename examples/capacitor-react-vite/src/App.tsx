import { useEffect, useState } from 'react';
import './App.css';
import { db } from './db';

function App() {
  const [docs, setDocs] = useState<any[]>([]);
  const [url, seturl] = useState<string>('');
  useEffect(() => {
    const init = async () => {
      const res = await db.allDocs({ include_docs: true, attachments: true, binary: true });
      setDocs(res.rows.map((item) => item.doc));
    };
    init();
  }, []);

  return (
    <div className="App">
      <h1>PouchDB Capicator SQLite Test</h1>
      <img src={url} />
      <button
        onClick={async () => {
          const doc = await db.get('8b9a4e2fbe3250a9b9294945c507cd98', {
            attachments: true,
            binary: true,
          });
          console.log(doc);

          const atts = doc._attachments!;
          console.log(Object.getPrototypeOf(atts));
          const d: Blob = (atts['04.png'] as any).data as Blob;

          const url = URL.createObjectURL(d);
          seturl(url);
        }}
      >
        retry
      </button>
      <button
        onClick={async () => {
          db.destroy();
        }}
      >
        retry
      </button>
      <p>Status: {docs.length}</p>
      <h2>Documents:</h2>
      <ul>
        {docs.map((doc) => (
          <li key={doc._id}>
            {doc._id}: {JSON.stringify(doc, null, 2)}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
