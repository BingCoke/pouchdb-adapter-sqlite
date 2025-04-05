import '../../install';
import { ScrollView, StyleSheet, Button, Image } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useCallback, useEffect, useState } from 'react';
import { db } from '@/db';

export default function TabOneScreen() {
  const [items, setItems] = useState<PouchDB.Core.AllDocsResponse<{}> | null>(null);
  const [all, setAll] = useState<string>('');
  const [imageData, setImageData] = useState<string | null>('');

  const init = useCallback(async () => {
    const doc = await db.allDocs({
      include_docs: true,
    });
    setAll(JSON.stringify(doc, null, 2));
    setItems(doc);
  }, []);
  useEffect(() => {
    init();

    const c = {
      ch: null as any,
    };
    const use = async () => {
      const info = await db.info();
      const seq = info.update_seq;
      const ch = db.changes({ live: true, since: seq });
      c.ch = ch;

      ch.on('change', async () => {
        init();
      });
    };
    use();

    return () => {
      c.ch?.cancel();
    };
  }, [init]);
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Expo SQLite Example</Text>
      <Text> DOC LENGTH : {items?.total_rows}</Text>
      <Button
        title="add doc"
        onPress={async () => {
          const doc = {
            _id: '8b9a4e2fbe3250a9b9294945c504ddaa',
            name: 'test',
            age: 18,
          };
          await db.put(doc);
          init();
        }}
      ></Button>
      <Button
        title="get file"
        onPress={async () => {
          try {
            const get = await db.get('8b9a4e2fbe3250a9b9294945c509510a', {
              attachments: true,
            });
            console.log(get);
            const file = get._attachments!['04.png'];
            console.log(file);
            if ('data' in file) {
              const d: string = file.data as string;
              setImageData('data:image/png;base64,' + d);
            }
          } catch (e: any) {
            console.error(e);
          }
        }}
      ></Button>
      <Button
        onPress={async () => {
          db.destroy();
        }}
        title="destory"
      ></Button>
      <ScrollView style={{ padding: 10 }}>
        {imageData && (
          <>
            <Image
              source={{ uri: imageData }}
              style={{ height: 100, resizeMode: 'contain', backgroundColor: 'red' }}
            />
          </>
        )}
        <Text>{all}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  separator: {
    marginVertical: 30,
    height: 1,
    width: '80%',
  },
});
