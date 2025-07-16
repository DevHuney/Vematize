'use server';

import clientPromise from '@/lib/mongodb';
import { unstable_noStore as noStore } from 'next/cache';

const OLD_DB_NAME = 'PFBR';
const NEW_DB_NAME = 'vematize';

export type MigrationResult = {
  success: boolean;
  messages: string[];
};

export async function migrateData(): Promise<MigrationResult> {
  noStore();
  const messages: string[] = [];
  try {
    const client = await clientPromise;
    const dbOld = client.db(OLD_DB_NAME);
    const dbNew = client.db(NEW_DB_NAME);

    const collectionsToMigrate = ['admins', 'tenants', 'plans', 'settings', 'users'];

    for (const collectionName of collectionsToMigrate) {
      const collectionOld = dbOld.collection(collectionName);
      const collectionNew = dbNew.collection(collectionName);

      const documentsToMigrate = await collectionOld.find({}).toArray();
      let migratedCount = 0;
      let skippedCount = 0;

      if (documentsToMigrate.length === 0) {
        messages.push(`Coleção '${collectionName}': Nenhum documento encontrado para migrar.`);
        continue;
      }

      for (const doc of documentsToMigrate) {
        // Use a unique key for checking existence. `_id` is the most reliable.
        const existingDoc = await collectionNew.findOne({ _id: doc._id });

        if (existingDoc) {
          skippedCount++;
        } else {
          await collectionNew.insertOne(doc);
          migratedCount++;
        }
      }
      messages.push(`Coleção '${collectionName}': ${migratedCount} documentos migrados, ${skippedCount} já existiam e foram ignorados.`);
    }

    return {
      success: true,
      messages,
    };
  } catch (error: any) {
    console.error('Migration failed:', error);
    return {
      success: false,
      messages: [
        'A migração falhou. Verifique os logs do servidor para mais detalhes.',
        error.message || 'Erro desconhecido.',
      ],
    };
  }
}
